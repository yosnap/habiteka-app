import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { meters, type SceneBox, type ScenePolygon } from './types';
import { floorFinish, floorSlabThicknessMm } from '@/lib/editor-document/floor-finishes';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';
import { rampArrival, rampArrivalTarget } from '@/lib/editor-document/ramp-arrival';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';

// Trigonometry introduces sub-nanometer slivers at shared edges (e.g. cos(π/2)).
// Give the boolean operation one common 0.00001 mm grid, far below editor precision.
const clean = (polygon: Polygon): Polygon => polygon.map((ring) => ring.map(([x, y]) =>
  [Math.round(x * 1e8) / 1e8, Math.round(y * 1e8) / 1e8]));

// Malla más gruesa (0,1 mm) para el reintento: colapsa las láminas que hacen fallar a la librería de recorte.
const coarse = (polygon: Polygon): Polygon => polygon.map((ring) => ring.map(([x, y]) =>
  [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]));

type Difference = (subject: Polygon, ...clips: Polygon[]) => Polygon[];

/**
 * Recorte del suelo con degradación por pasos: la librería de polígonos falla a veces con bordes casi colineales
 * («Unable to complete output ring»). Antes de renunciar se reintenta con una malla más gruesa y después
 * descartando solo el recorte problemático; en el peor caso se devuelve el suelo sin recortar. Así un caso
 * límite deja un hueco de pared sin recortar, nunca una escena 3D sin suelos.
 */
export function robustDifference(outline: Polygon, cuts: Polygon[], difference: Difference = polygonClipping.difference): Polygon[] {
  if (!cuts.length) return [outline];
  const attempt = (subject: Polygon, clips: Polygon[]) => { try { return difference(subject, ...clips); } catch { return null; } };
  const exact = attempt(clean(outline), cuts.map(clean));
  if (exact) return exact;
  const rough = attempt(coarse(outline), cuts.map(coarse));
  if (rough) return rough;
  let result: Polygon[] = [coarse(outline)];
  for (const cut of cuts.map(coarse)) {
    const next = result.flatMap((polygon) => attempt(polygon, [cut]) ?? [polygon]);
    result = next;
  }
  return result;
}

/** An elevated room is a structural volume, not a floating texture plane. */
export function floorMeshes(doc: EditorDocument, rooms: DerivedRoom[], walls: SceneBox[], joins: ScenePolygon[]): ScenePolygon[] {
  const obstaclesAt = (elevation: number): Polygon[] => {
    const obstacles = walls.filter((wall) => wall.position[1] - wall.size[1] / 2 <= elevation + 1e-7 &&
      wall.position[1] + wall.size[1] / 2 > elevation + 1e-7).map((wall) => {
      const angle = -wall.rotation, c = Math.cos(angle), s = Math.sin(angle);
      const [width, , depth] = wall.size;
      return [[[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
        .map(([x, y]) => [wall.position[0] + x! * c - y! * s, wall.position[2] + x! * s + y! * c] as Pair)];
    });
    for (const join of joins.filter((item) => item.elevation <= elevation + 1e-7 && item.elevation + item.height > elevation + 1e-7))
      obstacles.push([join.points.map((point) => [point.x, point.y])]);
    return obstacles;
  };
  return rooms.flatMap((room) => {
    const outline: Polygon = [room.boundary.map((p) => [meters(p.x), meters(p.y)])];
    const finish = floorFinish(doc, room.id), surfaceElevation = meters(finish.elevationMm ?? 0);
    const obstacles = obstaclesAt(surfaceElevation);
    const rampAccesses = (doc.ramps ?? []).flatMap((ramp) => {
      if (isRampLanding(ramp)) return [];
      const target = rampArrivalTarget(doc, ramp), arrival = rampArrival(ramp);
      if (target?.room.id !== room.id || Math.abs(arrival.elevationMm - (finish.elevationMm ?? 0)) > 1) return [];
      const part = rampParts(ramp).filter((item) => item.kind === 'flight').at(-1)!;
      return [[rampPartFootprint(ramp, part).map((point) => [meters(point.x), meters(point.y)] as Pair)]];
    });
    const cuts = [...obstacles, ...rampAccesses];
    const polygons = robustDifference(outline, cuts);
    const slabHeight = meters(floorSlabThicknessMm(finish));
    return polygons.map((rings, index) => ({
      id: index ? `${room.id}:surface:${index}` : room.id, sourceEntityId: room.id, role: 'floor' as const,
      points: rings[0]!.map(([x, y]) => ({ x, y })),
      holes: rings.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
      elevation: surfaceElevation - slabHeight, height: slabHeight, color: finish.color, floorFinish: finish,
      sideColor: finish.undersideColor ?? '#756f66',
    }));
  });
}
