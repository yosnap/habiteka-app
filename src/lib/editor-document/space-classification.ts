import type { EditorDocument } from './schema';
import { deriveRooms, type DerivedRoom } from './rooms';
import { insideRoom } from './ceiling-geometry';
import { designZoneRoomParts } from './design-zone-geometry';
import { polygonArea } from './geometry';
import { setFloorFinish } from './floor-finishes';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';

export type SpaceClassification = 'interior' | 'exterior';
const outdoorName = /\b(patio|terraza|jard[ií]n|balc[oó]n|exterior|porche|loggia)\b/i;
function automaticOutdoor(doc: EditorDocument, room: DerivedRoom): boolean {
  return room.wallIds.some(id => doc.walls.some(wall => wall.id === id && wall.hidden && !id.startsWith('hidden:open:')
    && (id.startsWith('hidden:') || id.startsWith('outdoor:'))))
    || doc.labels.some(label => outdoorName.test(label.text) && insideRoom(label, room.boundary));
}

/** La estancia manda; una zona explícita solo se hereda si cubre todo el recinto. */
export function roomClassification(doc: EditorDocument, room: DerivedRoom, rooms = deriveRooms(doc)): SpaceClassification {
  const explicit = doc.floorFinishes?.find(finish => finish.roomId === room.id)?.classification;
  if (explicit) return explicit;
  for (const zone of doc.designZones ?? []) {
    if (!zone.classification) continue;
    const area = designZoneRoomParts(zone, room).reduce((sum, polygon) => sum + polygon.reduce((part, ring, i) =>
      part + (i ? -1 : 1) * Math.abs(polygonArea(ring.map(([x, y]) => ({ x, y })))), 0), 0);
    if (area >= room.areaMm2 - 1) return zone.classification;
  }
  const wholeOutdoor = ['patio', 'terraza', 'jardin'].includes(doc.designSpaceKind ?? '')
    && !doc.ceilings?.length && rooms.every(candidate => !automaticOutdoor(doc, candidate));
  return wholeOutdoor || automaticOutdoor(doc, room) ? 'exterior' : 'interior';
}

export function setSpaceClassification(doc: EditorDocument, id: string, value: SpaceClassification | 'auto'): EditorDocument {
  if (!['auto', 'interior', 'exterior'].includes(value)) throw new Error('Clasificación inválida');
  const classification = value === 'auto' ? undefined : value;
  if (id.startsWith('room:')) return setFloorFinish(doc, id, { classification });
  const next = upgradeSpatialDocument(doc), zone = next.designZones?.find(item => item.id === id);
  if (!zone) throw new Error('La zona ya no existe');
  if (classification) zone.classification = classification; else delete zone.classification;
  next.revision += 1;
  return parseEditorDocument(next);
}
