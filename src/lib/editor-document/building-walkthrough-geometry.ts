import type { EditorDocument, Point } from './schema';
import { buildingWalkNavigation } from './building-free-walk';
import { distance } from './geometry';
import type { WalkthroughPath, WalkthroughWaypoint } from './walkthrough';
import { compileWalkthroughSamples, type WalkthroughSample } from './walkthrough-samples';
import type { WalkBlock } from './walkthrough-navigation';

/** La ruta entre plantas usa cotas absolutas y solo atraviesa enlaces de escalera validados. */
export function buildBuildingWalkthrough(doc: EditorDocument, route: WalkthroughPath) {
  const points = route.waypoints;
  if (points.length < 2) throw new Error('Añade al menos dos puntos al recorrido');
  if (route.loop) throw new Error('El recorrido entre plantas necesita un regreso explícito antes de cerrar un bucle.');
  if (route.zoneIds.length) throw new Error('Las estancias de una ruta entre plantas deben prepararse por planta.');
  if (points.some((point) => !point.levelId) || points[0]!.levelId !== doc.activeLevelId)
    throw new Error('La ruta debe empezar en su planta y asignar cada punto a una planta.');
  const context = buildingWalkNavigation(doc), samples: WalkthroughSample[] = [], invalidSegments: number[] = [];
  const blockedSegments: { index: number; block: WalkBlock }[] = [];
  const level = (point: WalkthroughWaypoint) => context.levels.find((item) => item.id === point.levelId);
  const height = (point: WalkthroughWaypoint) => {
    const current = level(point), nav = context.navs.get(point.levelId!);
    if (!current || !nav) throw new Error('Una planta del recorrido ya no existe.');
    return current.elevationMm + nav.floorAt(point) + point.eyeHeightMm;
  };
  const near = (point: Point, arrival: Point, direction: Point, side: -1 | 1, widthMm: number) => {
    const along = (point.x - arrival.x) * direction.x + (point.y - arrival.y) * direction.y;
    const across = Math.abs((point.x - arrival.x) * direction.y - (point.y - arrival.y) * direction.x);
    return across <= widthMm / 2 - 150 && (side === -1 ? along >= -80 && along <= 10 : along >= -10 && along <= 80);
  };
  let time = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const from = context.navs.get(a.levelId!)!, to = context.navs.get(b.levelId!)!;
    if (!from || !to) throw new Error('Una planta del recorrido ya no existe.');
    const changing = a.levelId !== b.levelId;
    const steps = Math.max(2, Math.ceil(distance(a, b) / 30));
    if (steps > 10000 || samples.length + steps > 30000) throw new Error('Tramo demasiado largo');
    let valid = true, invalidBlock: WalkBlock | null = null;
    if (changing) {
      const link = context.links.find((item) => (item.lowerLevelId === a.levelId && item.upperLevelId === b.levelId) ||
        (item.upperLevelId === a.levelId && item.lowerLevelId === b.levelId));
      const up = link?.lowerLevelId === a.levelId;
      valid = Boolean(link && near(a, link.arrival, link.direction, up ? -1 : 1, link.widthMm) &&
        near(b, link.arrival, link.direction, up ? 1 : -1, link.widthMm) &&
        from.free(a, a.eyeHeightMm) && to.free(b, b.eyeHeightMm) && Math.abs(height(a) - height(b)) <= 30);
      if (!valid) invalidBlock = from.blockAt(a, a.eyeHeightMm) ?? to.blockAt(b, b.eyeHeightMm) ??
        { kind: 'stair-link', point: a, entityId: link?.stairId };
    }
    const startHeight = height(a), endHeight = height(b);
    let previous: WalkthroughSample | null = null;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const eye = a.eyeHeightMm + (b.eyeHeightMm - a.eyeHeightMm) * t;
      if (!changing) {
        const block = from.blockAt(point, eye) ?? (j > 0 ? from.segmentBlock(
        { x: a.x + (b.x - a.x) * ((j - 1) / steps), y: a.y + (b.y - a.y) * ((j - 1) / steps) },
        point, eye) : null);
        if (block) { valid = false; invalidBlock ??= block; }
      }
      const h = changing ? startHeight + (endHeight - startHeight) * t : level(a)!.elevationMm + from.floorAt(point) + eye;
      const next: WalkthroughSample = { ...point, height: h, time, waypoint: a };
      if (previous) time += Math.hypot(next.x - previous.x, next.y - previous.y, next.height - previous.height) / a.speedMmPerS * 1000;
      next.time = time; samples.push(next); previous = next;
      if (j === 0 && a.dwellMs) { time += a.dwellMs; samples.push({ ...next, time }); }
    }
    if (!valid) { invalidSegments.push(i); blockedSegments.push({ index: i, block: invalidBlock! }); }
  }
  const last = points.at(-1)!;
  if (last.dwellMs) { time += last.dwellMs; samples.push({ ...samples.at(-1)!, time, waypoint: last }); }
  if (time < 100) throw new Error('Separa los puntos o añade una pausa para reproducir el recorrido.');
  return { ...compileWalkthroughSamples(samples, time, invalidSegments), blockedSegments, absoluteElevation: true as const };
}
