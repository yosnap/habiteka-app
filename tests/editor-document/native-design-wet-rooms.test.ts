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
import { toModelFurniture } from '@/lib/editor-document/proposal-coordinates';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { Furniture } from '@/lib/editor-document/schema';
import { parseNativeDesignProposal } from '@/server/agent/editor-v2/native-design-proposal';

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

  it('no repite los sanitarios que el baño ya tiene ni los que la IA pide dos veces', () => {
    // Dos Amueblar seguidos sobre un plano importado dejaron tres inodoros por baño.
    const room = () => upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 1800 }, { x: 0, y: 1800 }], true));
    const existing = (id: string, catalogId: string, x: number, y: number, widthMm: number, depthMm: number): Furniture =>
      ({ id, kind: catalogId.split(':').pop()!, catalogId, x, y, widthMm, depthMm, heightMm: 800, rotation: 0, elevationMm: 0, color: '#ffffff', dimensionalOrigin: 'physical' } as Furniture);
    const ask = (...ids: string[]) => ({ summary: 'Baño', materials: {}, furniture: ids.map((id, index) =>
      toModelFurniture({ catalogId: `habiteka:furniture:${id}`, xMm: 300 + index * 700, yMm: 100, rotation: 0, reason: 'Baño' })) });
    const free = { ...defaultRenderDesignOptions(), freedom: 'free' as const };
    const placed = (doc: ReturnType<typeof room>, raw: object) => parseNativeDesignProposal(raw, 'moderno', doc, free).furniture.map((item) => item.catalogId.split(':').pop());

    const imported = room();
    imported.furniture.push(existing('import:f9', 'habiteka:asset:inodoro', 1900, 1000, 400, 700),
      existing('mueble-lavabo', 'habiteka:model:mueble_lavabo_suelo_60', 100, 1200, 600, 475));
    expect(placed(imported, ask('inodoro', 'lavabo', 'ducha'))).toEqual(['ducha']);
    expect(placed(room(), ask('inodoro', 'inodoro'))).toEqual(['inodoro', 'lavabo']);
  });
});
