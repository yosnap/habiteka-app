/**
 * Sillas, mesillas y mesa de centro van en conjunto con su mesa, cama o sofá: la IA calculaba mal su sitio y casi todas
 * se descartaban (de cuatro sillas quedaba una y las mesillas acababan en otra pared).
 */
import { describe, expect, it } from 'vitest';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { footprint } from '@/lib/editor-document/spatial-properties';
import { barStools, bedsideTables, coffeeTable, COMPANION_RULES, diningChairs, rugBefore } from '@/lib/editor-document/native-design-seating';
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

  it('pone los taburetes en el frente de la isla y a los dos lados de una mesa alta', () => {
    // Isla de 1800 × 900 en (1000, 1000): tres taburetes bajo su canto inferior (y = 1900), de cara a ella.
    const island = barStools({ catalogId: 'habiteka:furniture:isla-cocina', xMm: 1000, yMm: 1000, rotation: 0, reason: '' }, 'habiteka:furniture:taburete');
    expect(island.map(box).map(([, minY]) => minY)).toEqual([1900, 1900, 1900]);
    expect(island.every((stool) => stool.rotation === 180)).toBe(true);
    const high = barStools({ catalogId: 'habiteka:asset:mesa_alta_redonda', xMm: 0, yMm: 0, rotation: 0, reason: '' }, 'habiteka:furniture:taburete');
    expect(high.map((stool) => stool.rotation).sort()).toEqual([0, 0, 180, 180]);
  });

  it('prueba primero la alfombra a la medida dibujada y después la del catálogo', () => {
    const sofa = { catalogId: 'habiteka:furniture:sofa-3', xMm: 1000, yMm: 75, rotation: 90, reason: '' };
    // Dibujada 1700 (x) × 2400 (y) junto a un sofá girado 90: a lo largo del sofá van 2400.
    const [custom, catalog] = rugBefore(sofa, 'habiteka:furniture:alfombra', { x: 1700, y: 2400 });
    expect(custom).toMatchObject({ widthMm: 2400, depthMm: 1700, rotation: 90 });
    expect(catalog).not.toHaveProperty('widthMm');
    expect(rugBefore(sofa, 'habiteka:furniture:alfombra')).toHaveLength(1);
  });

  it('una lámpara de mesa acompaña a cualquier mesilla, también a las de Poly Haven; el felpudo no es alfombra de salón', () => {
    const lamp = COMPANION_RULES.find((rule) => rule.name === 'lámpara')!;
    for (const id of ['habiteka:furniture:mesita', 'habiteka:asset:mesilla_madera_cajon']) expect(lamp.anchor(getFurnitureCatalogEntry(id))).toBe(true);
    expect(lamp.companion(getFurnitureCatalogEntry('habiteka:asset:lampara_mesa_industrial'))).toBe(true);
    expect(lamp.companion(getFurnitureCatalogEntry('habiteka:furniture:lampara-escritorio'))).toBe(false);
    const [table] = lamp.place({ catalogId: 'habiteka:furniture:mesita', xMm: 0, yMm: 0, rotation: 0, reason: '' }, 'habiteka:furniture:lampara-mesa');
    expect(box(table!)).toEqual([75, 50, 375, 350]);
    const rug = COMPANION_RULES.find((rule) => rule.name === 'alfombra')!;
    expect(rug.companion(getFurnitureCatalogEntry('habiteka:furniture:felpudo'))).toBe(false);
  });
});
