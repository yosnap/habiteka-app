/**
 * En un baño pequeño la IA ponía el inodoro y el lavabo en mitad de las paredes y la bañera ya no cabía: el baño se
 * quedaba sin ducha y el aseo sin lavabo. Los sanitarios se recolocan desde las esquinas y, si no cabe la bañera, ducha.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { roomWallFaces } from '@/lib/editor-document/room-wall-faces';
import { addSuggestedFurniture, nativeFurniturePlacementIssue, settleNativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';
import { packWetRoom, WET_PACK_ORDERS, wetScore } from '@/lib/editor-document/native-design-wet-rooms';

// Baño de 1700 × 1700 entre ejes con muros de 150 mm: suelo útil de 1550 × 1550, más corto que una bañera.
const bathroom = () => upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 1700, y: 0 }, { x: 1700, y: 1700 }, { x: 0, y: 1700 }], true));
const entries = ['banera', 'inodoro', 'lavabo'].map((id) => getFurnitureCatalogEntry(`habiteka:furniture:${id}`)!);

describe('sanitarios de la propuesta', () => {
  it('cambia la bañera que no cabe por una ducha y coloca inodoro y lavabo junto a ella', () => {
    const doc = bathroom(), rooms = deriveRooms(doc), faces = roomWallFaces(doc, rooms[0]!, 'E1', []);
    const placed = packWetRoom(entries, faces, { 'habiteka:furniture:banera': 'habiteka:furniture:ducha' }, (item, axis) => {
      const result = settleNativeDesignFurniture(doc, item, rooms, undefined, undefined, axis);
      if (result.issue) return null;
      addSuggestedFurniture(doc, result.item, rooms, new Set(rooms.map((room) => room.id)));
      return result.item;
    }, WET_PACK_ORDERS[0]);
    expect(placed.map((item) => item.catalogId.split(':').pop())).toEqual(['ducha', 'inodoro', 'lavabo']);
    for (const item of placed) expect(nativeFurniturePlacementIssue({ ...doc, furniture: doc.furniture.filter((other) => other.catalogId !== item.catalogId) }, item)).toBeNull();
  });

  it('valora más un baño con inodoro y lavabo que uno con ducha y sin lavabo', () => {
    const piece = (id: string) => ({ catalogId: `habiteka:furniture:${id}`, xMm: 0, yMm: 0, rotation: 0, reason: '' });
    expect(wetScore([piece('inodoro'), piece('lavabo')])).toBeGreaterThan(wetScore([piece('ducha'), piece('inodoro')]));
  });
});
