import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { meters, type SceneBox, type ScenePolygon } from './types';
import { floorFinish } from '@/lib/editor-document/floor-finishes';

// Trigonometry introduces sub-nanometer slivers at shared edges (e.g. cos(π/2)).
// Give the boolean operation one common 0.00001 mm grid, far below editor precision.
const clean = (polygon: Polygon): Polygon => polygon.map((ring) => ring.map(([x, y]) =>
  [Math.round(x * 1e8) / 1e8, Math.round(y * 1e8) / 1e8]));

/** Finished surface only: no inferred structural slab beneath the room. */
export function floorMeshes(doc: EditorDocument, rooms: DerivedRoom[], walls: SceneBox[], joins: ScenePolygon[]): ScenePolygon[] {
  // Clip only solids touching floor level. A door at elevation zero keeps its threshold.
  const obstacles: Polygon[] = walls.filter((wall) => wall.position[1] - wall.size[1] / 2 <= 1e-7 &&
    wall.position[1] + wall.size[1] / 2 > 1e-7).map((wall) => {
    const angle = -wall.rotation, c = Math.cos(angle), s = Math.sin(angle);
    const [width, , depth] = wall.size;
    return [[[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
      .map(([x, y]) => [wall.position[0] + x! * c - y! * s, wall.position[2] + x! * s + y! * c] as Pair)];
  });
  for (const join of joins.filter((j) => j.elevation <= 1e-7 && j.elevation + j.height > 1e-7))
    obstacles.push([join.points.map((p) => [p.x, p.y])]);
  return rooms.flatMap((room) => {
    const outline: Polygon = [room.boundary.map((p) => [meters(p.x), meters(p.y)])];
    const polygons = obstacles.length ? polygonClipping.difference(clean(outline), ...obstacles.map(clean)) : [outline];
    return polygons.map((rings, index) => ({
      id: index ? `${room.id}:surface:${index}` : room.id, sourceEntityId: room.id, role: 'floor' as const,
      points: rings[0]!.map(([x, y]) => ({ x, y })),
      holes: rings.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
      elevation: 0, height: 0, color: floorFinish(doc, room.id).color, floorFinish: floorFinish(doc, room.id),
    }));
  });
}
