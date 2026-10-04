/**
 * Sillas, mesillas y mesa de centro van en conjunto con su mesa, cama o sofá: la IA calculaba mal su sitio y casi todas
 * se descartaban (de cuatro sillas quedaba una y las mesillas acababan en otra pared).
 */
import { describe, expect, it } from 'vitest';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { footprint } from '@/lib/editor-document/spatial-properties';
import { bedsideTables, coffeeTable, diningChairs } from '@/lib/editor-document/native-design-seating';
import type { NativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';

const box = (item: NativeDesignFurniture) => {
  const entry = getFurnitureCatalogEntry(item.catalogId)!;
  const points = footprint({ x: item.xMm, y: item.yMm, rotation: item.rotation, widthMm: entry.widthMm, depthMm: entry.depthMm });
  const xs = points.map((point) => Math.round(point.x)), ys = points.map((point) => Math.round(point.y));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('conjuntos de la propuesta', () => {
  it('reparte las sillas de cara a la mesa, metidas bajo ella, y pone cabeceras en una mesa larga', () => {
    // Mesa de 1600 × 900 de (1000, 1000) a (2600, 1900); la silla de 520 de fondo entra 198 mm bajo el tablero.
    const table = { catalogId: 'habiteka:furniture:mesa-comedor', xMm: 1000, yMm: 1000, rotation: 0, reason: '' };
    const chairs = diningChairs(table, 'habiteka:furniture:silla-comedor');
    expect(chairs).toHaveLength(6);
    const boxes = chairs.map(box);
    expect(boxes.filter(([, , , maxY]) => maxY === 1198)).toHaveLength(2);
    expect(boxes.filter(([, minY]) => minY === 1702)).toHaveLength(2);
    expect(boxes.filter(([, , maxX]) => maxX === 1198)).toHaveLength(1);
    // Si así chocan (modelos 3D cuya caja ocupa el tablero), quedan tocando el canto.
    expect(diningChairs(table, 'habiteka:furniture:silla-comedor', false).map(box).filter(([, , , maxY]) => maxY === 1000)).toHaveLength(2);
    // La silla de arriba mira a la mesa: trasera arriba (giro 0); la de abajo, giro 180.
    expect(chairs.slice(0, 2).map((chair) => chair.rotation)).toEqual([0, 180]);
  });

  it('pone las mesillas a los lados del cabecero contra el mismo muro y la mesa de centro delante del sofá', () => {
    // Cama doble con el cabecero contra el muro izquierdo (x = 75), girada 270: ocupa y de 1000 a 2600.
    const bed = { catalogId: 'habiteka:furniture:cama-doble', xMm: 75, yMm: 2600, rotation: 270, reason: '' };
    const tables = bedsideTables(bed, 'habiteka:furniture:mesita').map(box);
    expect(tables.map(([minX]) => minX)).toEqual([75, 75]);
    expect(tables.map(([, minY, , maxY]) => [minY, maxY]).sort((a, b) => a[0]! - b[0]!)).toEqual([[550, 1000], [2600, 3050]]);
    // Sofá contra el muro de arriba (y = 75, 600 de fondo según el catálogo): la mesa empieza 40 cm delante.
    const sofa = getFurnitureCatalogEntry('habiteka:furniture:sofa-3')!;
    const [table] = coffeeTable({ catalogId: sofa.id, xMm: 1000, yMm: 75, rotation: 0, reason: '' }, 'habiteka:furniture:mesa-centro').map(box);
    expect(table![1]).toBe(75 + sofa.depthMm + 400);
    expect((table![0]! + table![2]!) / 2).toBe(1000 + sofa.widthMm / 2);
  });
});
