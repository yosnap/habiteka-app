import type { EditorDocument, Point, Wall } from './schema';
import { deriveRooms, type DerivedRoom } from './rooms';
import { joinPointToWall, wallSupportAt } from './wall-join';
import { mergeVertexInto } from './vertex-merge';
import { insideRoom } from './ceiling-geometry';

const isOutdoorWall = (wall: Wall) => wall.id.startsWith('outdoor:');
const CORNER_TOLERANCE_MM = 150;

/**
 * Acopla un patio a la construcción tras moverlo: cada vértice propio del patio que queda a un palmo de una
 * esquina de la casa se fusiona con ella, y el que apoya sobre un muro real lo divide y pasa a compartirlo.
 * Así el patio comparte muros con la casa igual que si se hubiera dibujado pegado. Devuelve el documento
 * intacto cuando no hay nada que acoplar.
 */
export function attachOutdoorRoom(source: EditorDocument, roomId: string): EditorDocument {
  const room = deriveRooms(source).find((r) => r.id === roomId);
  if (!room || !room.wallIds.some((id) => id.startsWith('outdoor:'))) return source;
  const own = room.vertexIds.filter((vertexId) => source.walls.every((wall) =>
    isOutdoorWall(wall) || (wall.startVertexId !== vertexId && wall.endVertexId !== vertexId)));
  let doc = structuredClone(source), attached = false;
  for (const vertexId of own) {
    const vertex = doc.vertices.find((v) => v.id === vertexId);
    if (!vertex) continue;
    const corner = doc.vertices.filter((v) => v.id !== vertexId && !room.vertexIds.includes(v.id) &&
      doc.walls.some((wall) => !wall.hidden && (wall.startVertexId === v.id || wall.endVertexId === v.id)))
      .map((v) => ({ v, distance: Math.hypot(v.x - vertex.x, v.y - vertex.y) }))
      .filter((c) => c.distance <= CORNER_TOLERANCE_MM).sort((a, b) => a.distance - b.distance)[0];
    if (corner) { doc = mergeVertexInto(doc, vertexId, corner.v.id); attached = true; continue; }
    const support = wallSupportAt(doc, vertex, { endClearanceMm: CORNER_TOLERANCE_MM });
    if (!support) continue;
    doc = mergeVertexInto(doc, vertexId, joinPointToWall(doc, support)); attached = true;
  }
  if (!attached) return source;
  // El identificador de la estancia deriva de sus muros: el acabado del suelo sigue al patio acoplado.
  // Si el acople no produce un patio reconocible, se conserva el documento sin acoplar antes que perder el suelo.
  const survivors = room.wallIds.filter((id) => id.startsWith('outdoor:') && doc.walls.some((wall) => wall.id === id));
  let rooms: DerivedRoom[];
  try { rooms = deriveRooms(doc); } catch { return source; }
  const successor = rooms.find((r) => survivors.some((id) => r.wallIds.includes(id)));
  if (!successor || rooms.length < deriveRooms(source).length) return source;
  const finish = doc.floorFinishes?.find((f) => f.roomId === roomId);
  if (finish) finish.roomId = successor.id;
  return doc;
}

/** Estancia cuyo contorno contiene el punto; sirve para reseleccionar un patio cuyo id cambió al acoplarse. */
export function roomAt(doc: EditorDocument, point: Point): DerivedRoom | undefined {
  return deriveRooms(doc).find((room) => insideRoom(point, room.boundary));
}
