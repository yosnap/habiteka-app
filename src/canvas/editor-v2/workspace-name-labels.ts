import type { EditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { interiorPoint } from './editing-operations';

/** Misma etiqueta y posición en las tres vistas; las estancias sin nombre tienen una etiqueta de trabajo. */
export function workspaceNameLabels(document: EditorDocument, hiddenIds: readonly string[] = []) {
  let rooms: ReturnType<typeof deriveRooms> = [];
  try { rooms = deriveRooms(document); } catch { /* Los trazos incompletos conservan sus textos. */ }
  const hidden = new Set(hiddenIds);
  return [
    ...document.labels.map(label => ({ ...label, editable: true, roomId: rooms.find(room => insideRoom(label, room.boundary))?.id })),
    ...rooms.flatMap((room, index) => document.labels.some(label => insideRoom(label, room.boundary)) ? [] : [{
      id: `workspace-name:${room.id}`, ...interiorPoint(room.boundary), text: `Estancia ${index + 1}`, roomId: room.id, editable: false,
    }]),
  ].filter(label => !hidden.has(label.id) && (!label.roomId || !hidden.has(label.roomId)));
}
