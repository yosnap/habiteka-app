import type { EditorDocument, Point } from './schema';
import { buildingWalkNavigation } from './building-free-walk';
import { stairLayout } from './stair-layout';
import { localToWorld } from './spatial-properties';
import { waypoint, type WalkthroughPath } from './walkthrough';

/** Ruta verificable por una escalera existente; usa los centros de los peldaños de su malla 3D. */
export function autoBuildingTour(doc: EditorDocument, stairId: string, destinationLevelId?: string): WalkthroughPath {
  const context = buildingWalkNavigation(doc);
  const link = context.links.find((item) =>
    (item.lowerLevelId === doc.activeLevelId || item.upperLevelId === doc.activeLevelId) && item.stairId === stairId &&
    (!destinationLevelId || (item.lowerLevelId === doc.activeLevelId ? item.upperLevelId : item.lowerLevelId) === destinationLevelId));
  if (!link) throw new Error('La escalera no conecta ambas plantas. Revisa altura y salida.');
  const lower = context.levels.find((level) => level.id === link.lowerLevelId)!;
  const stair = lower.document.stairs!.find((item) => item.id === stairId)!;
  const layout = stairLayout(stair), first = Math.floor((stair.stepCount - 1) / 2);
  const parts = stair.kind === 'straight' ? layout.steps
    : [...layout.steps.slice(0, first), ...layout.landings, ...layout.steps.slice(first)];
  const centers = parts.map((part) => localToWorld(stair,
    { x: part.x + part.widthMm / 2, y: part.y + part.depthMm / 2 }));
  const firstPart = parts[0]!;
  const entry = localToWorld(stair, { x: firstPart.x + firstPart.widthMm / 2, y: stair.depthMm + 250 });
  const lowerTop = { x: link.arrival.x - link.direction.x * 30, y: link.arrival.y - link.direction.y * 30 };
  const upperStart = { x: link.arrival.x + link.direction.x * 30, y: link.arrival.y + link.direction.y * 30 };
  const upperEnd = { x: link.arrival.x + link.direction.x * 400, y: link.arrival.y + link.direction.y * 400 };
  const lowerNav = context.navs.get(link.lowerLevelId)!, upperNav = context.navs.get(link.upperLevelId)!;
  if (!lowerNav.free(entry) || !lowerNav.segmentFree(entry, centers[0]!) ||
    !lowerNav.segmentFree(centers.at(-1)!, lowerTop) || !upperNav.segmentFree(upperStart, upperEnd))
    throw new Error('La ruta de la escalera está bloqueada. Revisa el acceso y los muebles.');
  const onLevel = (points: Point[], levelId: string) => points.map((point) => ({ ...waypoint(point), levelId }));
  const ascent = [...onLevel([entry, ...centers, lowerTop], link.lowerLevelId),
      { ...waypoint(upperStart), levelId: link.upperLevelId,
        lookAt: { x: link.arrival.x - link.direction.x * 900, y: link.arrival.y - link.direction.y * 900 } },
      ...onLevel([upperEnd], link.upperLevelId)];
  const ascending = link.lowerLevelId === doc.activeLevelId;
  const target = doc.levels?.find((level) => level.id === (ascending ? link.upperLevelId : link.lowerLevelId));
  return { id: crypto.randomUUID(), name: `${ascending ? 'Subida' : 'Bajada'} a ${target?.name ?? 'otra planta'}`.slice(0, 80),
    zoneIds: [], loop: false, waypoints: ascending ? ascent : ascent.reverse() };
}
