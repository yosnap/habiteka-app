import type { EditorDocument } from './schema';
import type { PropertyVisitFrame } from './property-visit-types';
import { buildingDocuments } from './building-levels';
import { walkthroughNavigation } from './walkthrough-navigation';
import { insideRoom } from './ceiling-geometry';

/** Cámaras del paseo verificadas contra el plano, incluidas las que miran al interior desde el umbral. */
export function propertyVisitRoomContext(document: EditorDocument, frame: PropertyVisitFrame) {
  const level = buildingDocuments(document).find(item => item.id === frame.levelId);
  if (!level) return null;
  const nav = walkthroughNavigation(level.document);
  const at = { x: frame.camera.position[0] * 1000, y: frame.camera.position[2] * 1000 };
  const focus = { x: frame.camera.focus[0] * 1000, y: frame.camera.focus[2] * 1000 };
  // No atribuir a la cámara una habitación que está al otro lado de una pared o puerta cerrada.
  const room = (nav.segmentFree(at, focus) ? nav.roomAt(focus) : undefined) ?? nav.roomAt(at);
  if (!room) return null;
  const name = level.document.labels.find(label => insideRoom(label, room.boundary))?.text
    ?? `Zona ${nav.rooms.findIndex(item => item.id === room.id) + 1}`;
  return { roomId: room.id, roomName: name, roomAreaM2: room.areaMm2 / 1e6, zones: [] };
}
