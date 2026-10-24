/**
 * Un armario que apenas cabe no se podía girar en su sitio para ponerlo en la otra pared. Al arrastrarlo o colocarlo,
 * una pieza de pared se orienta al muro al que se acerca su centro, como una puerta; una mesa no se gira.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument, footprint } from '@/lib/editor-document/spatial-properties';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';

// Habitación de 4000 × 3000 con muros de 150 mm: caras interiores en x = 75 y 3925, y = 75 y 2925.
const room = () => upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true));
const piece = (catalogId: string, cx: number, cy: number): Furniture => {
  const entry = getFurnitureCatalogEntry(catalogId)!;
  return { id: 'p', kind: entry.kind, catalogId, x: cx - entry.widthMm / 2, y: cy - entry.depthMm / 2, widthMm: entry.widthMm, depthMm: entry.depthMm,
    heightMm: entry.heightMm, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: entry.color };
};
const drop = (item: Furniture) => snapObject(room(), item, .08, true, { preserveRotation: true, orientToWall: true }) as Furniture;
const bounds = (item: Furniture) => {
  const points = footprint(item), xs = points.map((p) => Math.round(p.x)), ys = points.map((p) => Math.round(p.y));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

describe('orientación de muebles contra la pared al arrastrar', () => {
  it('un armario llevado junto a la pared izquierda se gira con la trasera contra ella', () => {
    const placed = drop(piece('habiteka:furniture:armario', 300, 1500));
    expect(placed.rotation).toBe(270);
    expect(bounds(placed)).toMatchObject({ minX: 75, maxX: 675 });
  });

  it('junto a la pared de arriba queda con la trasera arriba y no salta en el rincón', () => {
    for (const [cx, cy] of [[1500, 300], [700, 350], [900, 380]] as const) {
      const placed = drop(piece('habiteka:furniture:armario', cx, cy));
      expect(placed.rotation).toBe(0);
      expect(bounds(placed).minY).toBe(75);
    }
  });

  it('una mesa se queda como la giró el usuario', () => {
    expect(drop(piece('habiteka:furniture:mesa-comedor', 300, 1500)).rotation).toBe(0);
  });
});

describe('memoria del giro en los rincones', () => {
  it('no alterna de pared con pequeñas oscilaciones y cambia al llevarlo claramente a otra', () => {
    const doc = room();
    let rotation = 0;
    const move = (cx: number, cy: number) => {
      const placed = snapObject(doc, piece('habiteka:furniture:armario', cx, cy), .08, true,
        { preserveRotation: true, orientToWall: true, preferredRotation: rotation }) as Furniture;
      rotation = placed.rotation;
      return placed;
    };
    for (const cy of [665, 680, 670, 690, 660, 680]) expect(move(375, cy).rotation).toBe(0);
    expect(move(375, 1100).rotation).toBe(270);
    expect(move(2000, 1500).rotation).toBe(270);
    for (const cy of [680, 670, 690, 660]) expect(move(375, cy).rotation).toBe(270);
    expect(move(1600, 375).rotation).toBe(0);
  });

  it('repetir el mismo punto tras un giro mantiene posición y orientación', () => {
    const doc = room(), raw = piece('habiteka:furniture:armario', 375, 1500);
    const first = snapObject(doc, raw, .08, true, { preserveRotation: true, orientToWall: true, preferredRotation: 0 });
    for (let i = 0; i < 20; i++) {
      expect(snapObject(doc, raw, .08, true, { preserveRotation: true, orientToWall: true, preferredRotation: first.rotation })).toEqual(first);
    }
  });

  it('un armario en horizontal no salta a la pared lateral aunque su centro quede más cerca de ella', () => {
    // Centro a 300 mm de la pared de arriba y a 250 de la izquierda: sin memoria se giraba en vertical.
    const item = piece('habiteka:furniture:armario', 325, 375);
    const kept = snapObject(room(), item, .08, true, { preserveRotation: true, orientToWall: true, preferredRotation: 0 }) as Furniture;
    expect(kept.rotation).toBe(0);
    const turned = snapObject(room(), item, .08, true, { preserveRotation: true, orientToWall: true, preferredRotation: 270 }) as Furniture;
    expect(turned.rotation).toBe(270);
  });
});
