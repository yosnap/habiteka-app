import type { EditorDocument, Point, Wall } from './schema';
import { wallPoints } from './geometry';
import { deriveRoomsSafe } from './rooms';
import { insideRoom } from './ceiling-geometry';

/** Bordes sin cuerpo: los de patio y los ocultos de versiones anteriores sin prefijo (nunca los límites `hidden:`). */
const isOutdoorWall = (wall: Wall) => wall.hidden === true && !wall.id.startsWith('hidden:') && wall.thicknessMm <= 10;
const HUG_MM = 200;
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** Cruce propio de dos segmentos, sin contar los que solo se tocan en un extremo. */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Elimina bordes de patio huérfanos: tramos ocultos que no delimitan ningún patio y además cruzan un muro real,
 * quedan dentro de una estancia o duplican otro tramo. Son restos de contornos anteriores que el usuario no puede
 * ver ni seleccionar y que parten las estancias que se dibujan encima. Un contorno abierto en zona libre se conserva.
 */
export function pruneOrphanOutdoorEdges(doc: EditorDocument, options: { aggressive?: boolean } = {}): EditorDocument {
  // Un «patio» de bordes ocultos con menos de 0,25 m² es un bucle residual, no una superficie: sus bordes no cuentan.
  const rooms = deriveRoomsSafe(doc).filter((room) => room.areaMm2 >= 250000 || !room.wallIds.every((id) => id.startsWith('outdoor:')));
  const used = new Set(rooms.flatMap((room) => room.wallIds));
  const visible = doc.walls.filter((wall) => !wall.hidden).map((wall) => wallPoints(doc, wall));
  const outdoor = doc.walls.filter(isOutdoorWall);
  const near = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y) <= 20;
  const junk = new Set<string>();
  for (const wall of outdoor) {
    if (used.has(wall.id)) continue;
    const [a, b] = wallPoints(doc, wall), middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const crossesWall = visible.some(([c, d]) => segmentsCross(a, b, c, d));
    const insideSomeRoom = rooms.some((room) => insideRoom(middle, room.boundary));
    const duplicate = outdoor.some((other) => other.id !== wall.id && !junk.has(other.id) && (used.has(other.id) || other.id < wall.id) &&
      (() => { const [c, d] = wallPoints(doc, other); return (near(a, c) && near(b, d)) || (near(a, d) && near(b, c)); })());
    const degenerateLoop = deriveRoomsSafe(doc).some((room) => room.wallIds.includes(wall.id));
    // Al cargar (sin trazado en curso) también sobra un tramo suelto que va pegado a muros o bordes ya existentes.
    const hugs = options.aggressive === true && [a, b].every((p) =>
      visible.some(([c, d]) => segmentDistance(p, c, d) <= HUG_MM) ||
      rooms.some((room) => room.boundary.some((c, i) => segmentDistance(p, c, room.boundary[(i + 1) % room.boundary.length]!) <= HUG_MM)));
    if (crossesWall || insideSomeRoom || duplicate || degenerateLoop || hugs) junk.add(wall.id);
  }
  if (!junk.size) return doc;
  const walls = doc.walls.filter((wall) => !junk.has(wall.id));
  const referenced = new Set(walls.flatMap((wall) => [wall.startVertexId, wall.endVertexId]));
  return { ...doc, walls, vertices: doc.vertices.filter((vertex) => referenced.has(vertex.id)),
    openings: doc.openings.filter((opening) => !junk.has(opening.wallId)) };
}
