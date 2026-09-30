/**
 * Una propuesta editable no solo debe caber: tiene que tener sentido. Al aire libre no van objetos de interior,
 * el paso a escaleras y puertas queda libre y plantas o lámparas de suelo se colocan junto a un borde.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { nativeFurniturePlacementIssue } from '@/lib/editor-document/native-design-proposal';
import { plantPlacementHints } from '@/server/agent/editor-v2/native-design-placement-hints';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

const item = (catalogId: string, xMm: number, yMm: number) => ({ catalogId, xMm, yMm, rotation: 0, reason: '' });
// Casa de 4000 × 4000 y un patio abierto de 5000 × 4000 a su derecha (x 4000–9000).
const patio = () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  return upgradeSpatialDocument(addOutdoorArea(house, { x: 4000, y: 0 }, { x: 9000, y: 4000 }));
};
const stair: Stair = {
  id: 'escalera', catalogId: 'builtin:stair-straight', kind: 'straight',
  x: 6000, y: 1500, widthMm: 1000, depthMm: 1200, rotation: 0,
  heightMm: 900, stepCount: 5, elevationMm: 0, materialId: 'concrete-grey', color: '#b9b9b9',
};

describe('propuesta de diseño con sentido', () => {
  it('rechaza una lámpara de pie de interior en un patio', () => {
    expect(nativeFurniturePlacementIssue(patio(), item('habiteka:furniture:lampara-pie', 4400, 400))).toBe('environment');
  });

  it('acepta una planta de exterior junto al borde y rechaza otra en mitad del patio', () => {
    expect(nativeFurniturePlacementIssue(patio(), item('habiteka:outdoor:planta-exterior', 4500, 450))).toBeNull();
    expect(nativeFurniturePlacementIssue(patio(), item('habiteka:outdoor:planta-exterior', 6200, 1700))).toBe('edge');
  });

  it('no deja un objeto tapando el paso a una escalera', () => {
    const doc = { ...patio(), stairs: [stair] };
    // A 500 mm de la escalera: cabe y no solapa, pero corta el acceso.
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:outdoor:planta-exterior', 5300, 1500))).toBe('circulation');
    // A más de un metro y junto al borde sí es válido.
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:outdoor:planta-exterior', 8300, 450))).toBeNull();
  });

  it('ofrece a la IA solo posiciones de vegetación que pasan todas las reglas', () => {
    const doc = { ...patio(), stairs: [stair] };
    const indoor = new Set(eligibleCeilingRooms(doc).map((room) => room.id));
    const outdoor = deriveRooms(doc).filter((room) => !indoor.has(room.id));
    const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['plants' as const] };
    const text = plantPlacementHints(doc, outdoor, undefined, options);
    const listed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as { catalogId: string; xMm: number; yMm: number; rotation: number }[];
    expect(listed.length).toBeGreaterThan(0);
    for (const entry of listed) {
      expect(nativeFurniturePlacementIssue(doc, { ...entry, reason: '' })).toBeNull();
    }
  });
});
