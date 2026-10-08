/**
 * Una propuesta editable no solo debe caber: tiene que tener sentido. Al aire libre no van objetos de interior,
 * el paso a escaleras y puertas queda libre y plantas o lámparas de suelo se colocan junto a un borde.
 */
import { describe, expect, it } from 'vitest';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { nativeFurniturePlacementIssue } from '@/lib/editor-document/native-design-proposal';
import { fromModelFurniture } from '@/lib/editor-document/proposal-coordinates';
import { plantPlacementHints, rugPlacementHints } from '@/server/agent/editor-v2/native-design-placement-hints';
import { collisions } from '@/canvas/editor-v2/spatial-placement';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';

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
  it('reserva delante de una puerta lo que necesita su hoja, no un cuadrado con un metro de margen', () => {
    const base = patio(), vertex = (id: string) => base.vertices.find((item) => item.id === id)!;
    const front = base.walls.find((wall) => vertex(wall.startVertexId).y === 4000 && vertex(wall.endVertexId).y === 4000)!;
    // Puerta de 900 mm en el centro del muro inferior de la casa (x = 2000).
    const doc = addOpening(base, front.id, { x: 2000, y: 4000 }, 'puerta');
    // Un armario contra ese muro, al lado de la puerta, ya no se rechaza.
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:furniture:armario', 2700, 3300))).toBeNull();
    // Una cama que invade el paso de la puerta sigue fuera.
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:furniture:cama-doble', 1200, 1500))).toBe('circulation');
  });

  it('deja seguidos los módulos de cocina, pero no un sofá pegado a ellos', () => {
    const doc = patio(), kitchen = getFurnitureCatalogEntry('habiteka:furniture:mueble-cocina')!;
    doc.furniture.push({ id: 'k1', kind: kitchen.kind, catalogId: kitchen.id, x: 300, y: 200, widthMm: kitchen.widthMm,
      depthMm: kitchen.depthMm, heightMm: kitchen.heightMm, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: kitchen.color });
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:furniture:fregadero', 300 + kitchen.widthMm, 200))).toBeNull();
    expect(nativeFurniturePlacementIssue(doc, item('habiteka:furniture:sofa-2', 300 + kitchen.widthMm, 200))).toBe('collision');
  });
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
    const listed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as { catalogId: string; cxMm: number; cyMm: number; rotation: number }[];
    expect(listed.length).toBeGreaterThan(0);
    for (const entry of listed) {
      expect(nativeFurniturePlacementIssue(doc, fromModelFurniture({ ...entry, reason: '' })!)).toBeNull();
    }
  });

  // Una alfombra cubre el suelo: los muebles se apoyan encima y no chocan con ella.
  describe('alfombras', () => {
    const room = () => {
      const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true));
      doc.furniture.push(
        { id: 'sofa', kind: 'sofa-2', catalogId: 'habiteka:furniture:sofa-2', x: 2000, y: 1500, widthMm: 1800, depthMm: 900, heightMm: 820, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: '#b9b5aa' },
        { id: 'mesa', kind: 'mesa-centro', catalogId: 'habiteka:furniture:mesa-centro', x: 2200, y: 2600, widthMm: 1100, depthMm: 600, heightMm: 420, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: '#bc9465' });
      return doc;
    };

    it('acepta una alfombra debajo del sofá y la mesa', () => {
      expect(nativeFurniturePlacementIssue(room(), item('habiteka:furniture:alfombra', 1900, 1700))).toBeNull();
    });

    it('un mueble sobre una alfombra existente no cuenta como choque', () => {
      const doc = room();
      doc.furniture.push({ id: 'alfombra', kind: 'alfombra', catalogId: 'habiteka:furniture:alfombra', x: 1900, y: 1700, widthMm: 2000, depthMm: 1500, heightMm: 10, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: '#c9c3b6' });
      const keys = [...collisions(doc).keys()].filter((key) => key.includes('alfombra'));
      expect(keys).toEqual([]);
    });

    it('sugiere una alfombra centrada en la zona de estar que pasa todas las reglas', () => {
      const doc = room();
      const rooms = deriveRooms(doc);
      const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['decor' as const] };
      const text = rugPlacementHints(doc, rooms, undefined, options);
      expect(text).toContain('alfombra');
      const listed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as { catalogId: string; cxMm: number; cyMm: number; rotation: number }[];
      expect(nativeFurniturePlacementIssue(doc, fromModelFurniture({ ...listed[0]!, reason: '' })!)).toBeNull();
    });

    it('no sugiere alfombra si no hay dónde sentarse', () => {
      const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['decor' as const] };
      const vacio = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true));
      expect(rugPlacementHints(vacio, deriveRooms(vacio), undefined, options)).toBe('');
    });
  });
});
