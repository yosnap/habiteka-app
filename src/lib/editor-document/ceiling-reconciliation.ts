import type { EditorDocument } from './schema';
import { deriveRooms } from './rooms';

/**
 * Conserva el anclaje al partir/fusionar tramos del mismo recinto. Una división
 * o fusión de habitaciones ambigua queda pendiente de revisión, nunca se asigna
 * por proximidad ni se eliminan techo/luminarias en silencio.
 */
export function reconcileCeilings(previous: EditorDocument, candidate: EditorDocument): EditorDocument {
  if (!previous.ceilings?.length || !candidate.ceilings?.length || previous.activeLevelId !== candidate.activeLevelId) return candidate;
  let before, after;
  try { before = deriveRooms(previous); after = deriveRooms(candidate); }
  catch { return candidate; }
  const proposed = candidate.ceilings.map((ceiling) => {
    if (after.some((room) => room.id === ceiling.roomId)) return ceiling;
    const old = before.find((room) => room.id === ceiling.roomId);
    if (!old) return ceiling;
    const matches = after.filter((room) => room.wallIds.filter((id) => old.wallIds.includes(id)).length >= 2);
    if (matches.length !== 1) return ceiling;
    // Si varias estancias antiguas confluyen, el nuevo recinto requiere elección.
    const target = matches[0]!;
    const owners = before.filter((room) => room.wallIds.filter((id) => target.wallIds.includes(id)).length >= 2);
    return owners.length === 1 ? { ...ceiling, roomId: target.id } : ceiling;
  });
  if (proposed.every((ceiling, index) => ceiling === candidate.ceilings![index])) return candidate;
  return { ...candidate, ceilings: proposed };
}
