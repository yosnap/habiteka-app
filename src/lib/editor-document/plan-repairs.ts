/**
 * Reparaciones automáticas de los defectos que `planIssues` sabe localizar.
 *
 * Son comandos puros: reciben un documento y devuelven otro validado, para que
 * el editor los aplique con `store.apply` y se deshagan con ⌘Z como cualquier
 * otra edición. Nunca tocan la revisión: eso es cosa del servidor.
 */
import { mergeVertexInto } from './vertex-merge';
import { planDefects } from './plan-issues';
import { deriveRooms } from './rooms';
import type { EditorDocument } from './schema';
import { parseEditorDocument } from './validation';

/**
 * Funde los muros de longitud casi nula: los dos vértices del muro pasan a ser
 * uno, los muros y huecos que apuntaban al vértice retirado quedan cosidos a su
 * gemelo y el muro desaparece sin abrir el contorno.
 */
export function collapseDegenerateWalls(source: EditorDocument): EditorDocument {
  let doc = parseEditorDocument(source);
  const ids = planDefects(doc).degenerateWallIds;
  if (!ids.length) throw new Error('No hay muros de longitud casi nula que fundir.');
  for (const id of ids) {
    // Cada fusión rehace la lista de muros: se vuelve a buscar por id.
    const wall = doc.walls.find((candidate) => candidate.id === id);
    if (!wall) continue;
    doc = mergeVertexInto(doc, wall.endVertexId, wall.startVertexId);
  }
  return parseEditorDocument(doc);
}

/**
 * Quita los acabados de suelo cuya estancia ya no existe (los identificadores
 * de estancia se derivan de sus muros y cambian al redibujarlos). Si el contorno
 * está tan roto que no se pueden deducir las estancias, se niega en vez de
 * borrar: sería tirar acabados buenos.
 *
 * No se limpia solo dentro de las operaciones que dejan huérfanos (fundir un
 * muro cambia el identificador de la estancia): ahí un acabado «huérfano» suele
 * ser el mismo suelo con otro identificador, y `inheritFloorFinishes` es quien
 * lo hereda. Se limpia a mano, cuando el usuario lo pide.
 */
export function pruneOrphanFloorFinishes(source: EditorDocument): EditorDocument {
  const doc = parseEditorDocument(source);
  const finishes = doc.floorFinishes ?? [];
  let roomIds: Set<string>;
  try {
    roomIds = new Set(deriveRooms(doc).map((room) => room.id));
  } catch {
    throw new Error('No se pueden deducir las estancias: arregla antes el contorno de muros.');
  }
  const kept = finishes.filter((finish) => roomIds.has(finish.roomId));
  if (kept.length === finishes.length)
    throw new Error('No hay acabados de suelo huérfanos que limpiar.');
  return parseEditorDocument({ ...doc, floorFinishes: kept });
}
