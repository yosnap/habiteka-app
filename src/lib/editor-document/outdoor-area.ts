import type { EditorDocument, Point } from './schema';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { deriveRooms } from './rooms';
import { setFloorFinish } from './floor-finishes';

/** Área abierta: comparte lados existentes y solo añade delimitadores sin volumen. */
export function addOutdoorArea(source: EditorDocument, from: Point, to: Point, name = 'Patio / terraza'): EditorDocument {
  if (Math.abs(to.x - from.x) < 200 || Math.abs(to.y - from.y) < 200) throw new Error('El patio necesita al menos 20 cm en cada lado.');
  const doc = upgradeSpatialDocument(source);
  const x = Math.min(from.x, to.x), y = Math.min(from.y, to.y), right = Math.max(from.x, to.x), bottom = Math.max(from.y, to.y);
  const points = [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }];
  const ids = points.map((point) => {
    const found = doc.vertices.find((v) => Math.hypot(v.x - point.x, v.y - point.y) < .01);
    if (found) return found.id;
    const id = crypto.randomUUID(); doc.vertices.push({ ...point, id }); return id;
  });
  for (let i = 0; i < 4; i++) {
    const a = ids[i]!, b = ids[(i + 1) % 4]!;
    if (doc.walls.some((wall) => (wall.startVertexId === a && wall.endVertexId === b) || (wall.startVertexId === b && wall.endVertexId === a))) continue;
    doc.walls.push({ id: `outdoor:${crypto.randomUUID()}`, startVertexId: a, endVertexId: b,
      thicknessMm: 10, dimensionalOrigin: 'physical', hidden: true, heightMm: 100,
      materials: { left: 'plaster-white', right: 'plaster-white' }, colors: { left: '#dddddd', right: '#dddddd' } });
  }
  const validated = parseEditorDocument(doc);
  const rooms = deriveRooms(validated);
  const room = rooms.find((candidate) => ids.every((id) => candidate.vertexIds.includes(id)) && candidate.vertexIds.length === 4);
  if (!room) throw new Error('Dibuja el patio fuera de las habitaciones, con un borde completo si lo unes a la casa.');
  if (deriveRooms(source).some((candidate) => candidate.id === room.id)) throw new Error('Ya existe una superficie en ese contorno. Selecciona su suelo para cambiarlo.');
  validated.labels.push({ id: crypto.randomUUID(), x: (x + right) / 2, y: (y + bottom) / 2, text: name });
  return setFloorFinish(validated, room.id, { texture: 'outdoor:paving', color: '#ffffff', tileSizeMm: 1000 });
}

/** Commit each clicked edge; an open outline survives Escape and undo. */
export function addOutdoorEdge(source: EditorDocument, from: Point, to: Point): EditorDocument {
  const doc = upgradeSpatialDocument(source);
  const ids = [from, to].map((point) => {
    const found = doc.vertices.find((v) => Math.hypot(v.x - point.x, v.y - point.y) < .01);
    if (found) return found.id;
    const id = crypto.randomUUID(); doc.vertices.push({ ...point, id }); return id;
  });
  if (doc.walls.some((w) => [w.startVertexId, w.endVertexId].every((id) => ids.includes(id))))
    throw new Error('Ese tramo ya existe');
  doc.walls.push({ id: `outdoor:${crypto.randomUUID()}`, startVertexId: ids[0]!, endVertexId: ids[1]!,
    thicknessMm: 10, dimensionalOrigin: 'physical', hidden: true, heightMm: 100,
    materials: { left: 'plaster-white', right: 'plaster-white' }, colors: { left: '#dddddd', right: '#dddddd' } });
  let next = parseEditorDocument(doc);
  const existing = new Set(deriveRooms(source).map((r) => r.id));
  for (const room of deriveRooms(next).filter((r) => !existing.has(r.id))) {
    next = setFloorFinish(next, room.id, { texture: 'outdoor:paving', color: '#ffffff', tileSizeMm: 1000 });
  }
  return next;
}
