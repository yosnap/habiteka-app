import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import { wallPoints } from '@/lib/editor-document/geometry';
import { alignPoints, type MagneticGuide } from './magnetic-alignment';
import { snapRadiusMm } from './snap-radius';
export interface WallMoveSnap { delta: Point; guides: MagneticGuide[]; }
/** El imán (ejes y vértices, sin caras) manda sobre la rejilla de 10 cm, que solo actúa en el eje sin referencia. */
export function snapWallMove(doc: EditorDocument, wall: Wall, rawDelta: Point, scale: number, enabled: boolean): WallMoveSnap {
  if (!enabled) return { delta: rawDelta, guides: [] };
  const [a, b] = wallPoints(doc, wall);
  const points = [a, b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }].map((p) => ({ x: p.x + rawDelta.x, y: p.y + rawDelta.y }));
  const incident = doc.walls.filter((w) => [wall.startVertexId, wall.endVertexId].includes(w.startVertexId) || [wall.startVertexId, wall.endVertexId].includes(w.endVertexId)).map((w) => w.id);
  const options = { faces: false, toleranceMm: snapRadiusMm(scale, 10) };
  const fromRaw = alignPoints(doc, points, scale, enabled, incident, options);
  // Sin referencia desde la posición cruda, la rejilla acerca ese eje y el imán vuelve a intentarlo desde ahí.
  const grid = { x: Math.round((a.x + rawDelta.x) / 100) * 100 - a.x, y: Math.round((a.y + rawDelta.y) / 100) * 100 - a.y };
  const mixed = { x: fromRaw.snapped.x ? rawDelta.x + fromRaw.delta.x : grid.x, y: fromRaw.snapped.y ? rawDelta.y + fromRaw.delta.y : grid.y };
  const fromMixed = alignPoints(doc, points.map((p) => ({ x: p.x - rawDelta.x + mixed.x, y: p.y - rawDelta.y + mixed.y })), scale, enabled, incident, options);
  // Las guías salen de la segunda pasada: en los ejes ya imantados su desplazamiento es cero, así que describen la posición final.
  return { delta: { x: mixed.x + fromMixed.delta.x, y: mixed.y + fromMixed.delta.y }, guides: fromMixed.guides };
}
