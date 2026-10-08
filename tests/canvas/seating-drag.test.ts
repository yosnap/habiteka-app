import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { furnitureCollisionVolumes, calibratedFurnitureProxy } from '@/lib/editor-document/furniture-collision-volumes';
import { objectCenter, localToWorld } from '@/lib/editor-document/spatial-properties';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { collisions, assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';
import { constrainSeatingDrag } from '@/canvas/editor-v2/seating-drag';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { planDragPosition, type PlanDrag } from '@/components/editor-v2/scene/scene-plan-interaction';

function fixture(tableId = 'mesa_comedor_roble_160', angle = 0) {
  let doc = addFurniture(emptyEditorDocument(), getFurnitureCatalogEntry(`habiteka:model:${tableId}`)!, { x: 0, y: 0 });
  doc = addFurniture(doc, getFurnitureCatalogEntry('habiteka:model:silla_nordica_roble')!, { x: 4000, y: 4000 });
  const [table, chair] = doc.furniture as [Furniture, Furniture]; table.rotation = angle; chair.rotation = angle + 180;
  const at = (inset: number, lateral = table.widthMm / 2) => {
    const center = localToWorld(table, { x: lateral, y: table.depthMm + chair.depthMm / 2 - inset });
    const offset = objectCenter({ ...chair, x: 0, y: 0 });
    return { ...chair, x: center.x - offset.x, y: center.y - offset.y };
  };
  return { doc, table, chair, at };
}
function placed(doc: EditorDocument, chair: Furniture) {
  return { ...doc, furniture: doc.furniture.map((item) => item.id === chair.id ? chair : item) };
}

describe('asientos y soportes reales de mesas', () => {
  it.each([0, 37, 90, 180])('admite 25 cm bajo el tablero con giro %s y bloquea el respaldo al entrar demasiado', (angle) => {
    const { doc, at } = fixture('mesa_comedor_roble_160', angle);
    expect(calibratedFurnitureProxy(doc.furniture[0]!)).toBeDefined();
    expect(collisions(placed(doc, at(250))).size).toBe(0);
    expect(() => assertSpatialPlacement(doc, placed(doc, at(250)))).not.toThrow();
    expect(() => assertSpatialPlacement(doc, placed(doc, at(600)))).toThrow('atraviesa');
  });
  it('distingue una pata de cuatro apoyos, un pedestal y los caballetes con travesaño', () => {
    const rectangular = fixture();
    expect(collisions(placed(rectangular.doc, rectangular.at(250, 110))).size).toBe(1);
    const pedestal = fixture('mesa_redonda_marmol_120');
    expect(collisions(placed(pedestal.doc, pedestal.at(180))).size).toBe(0);
    expect(collisions(placed(pedestal.doc, pedestal.at(750))).size).toBe(1);
    const easel = fixture('mesa_comedor_nogal_180');
    expect(collisions(placed(easel.doc, easel.at(180))).size).toBe(0);
    expect(collisions(placed(easel.doc, easel.at(700))).size).toBe(1);
  });
  it('no salta una pata aunque el destino esté libre al otro lado, y permite rodearla', () => {
    const { doc, at } = fixture();
    const from = at(-100, 110), target = at(1600, 110);
    expect(collisions(placed(doc, from)).size).toBe(0);
    expect(collisions(placed(doc, target)).size).toBe(0);
    const stopped = constrainSeatingDrag(doc, from, target);
    expect(Math.abs(stopped.y - from.y)).toBeLessThan(150);
    expect(collisions(placed(doc, stopped)).size).toBe(0);
    const retreat = constrainSeatingDrag(doc, stopped, from);
    const outside = constrainSeatingDrag(doc, retreat, at(-100));
    const inside = constrainSeatingDrag(doc, outside, at(250));
    expect(inside).toMatchObject(at(250));
  });
  it('también detiene una mesa arrastrada contra una silla y respeta la elevación', () => {
    const { doc, table, at } = fixture();
    const chair = at(-100, 110), source = placed(doc, chair);
    const target = { ...table, y: table.y + 1600 };
    expect(constrainSeatingDrag(source, table, target).y).toBeLessThan(150);
    const raised = { ...table, elevationMm: 1000 }, raisedTarget = { ...target, elevationMm: 1000 };
    expect(constrainSeatingDrag(placed(source, raised), raised, raisedTarget)).toEqual(raisedTarget);
  });
  it('escala los sólidos y conserva un margen libre bajo una mesa elevada', () => {
    const { table } = fixture();
    const before = furnitureCollisionVolumes(table);
    const after = furnitureCollisionVolumes({ ...table, widthMm: table.widthMm * 2, depthMm: table.depthMm * 2,
      heightMm: table.heightMm! * 2, elevationMm: 900 });
    expect(after).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.x).toBeCloseTo(before[i]!.x * 2);
      expect(after[i]!.widthMm).toBeCloseTo(before[i]!.widthMm * 2);
      expect(after[i]!.bottom).toBeCloseTo(before[i]!.bottom * 2 + 900);
      expect(after[i]!.top).toBeCloseTo(before[i]!.top * 2 + 900);
    }
  });
  it('incluye los brazos de un sillón y mantiene el imán de giro lejos de la mesa', () => {
    const { doc, chair, at } = fixture();
    Object.assign(chair, { catalogId: 'habiteka:asset:sillon_moderno', widthMm: 820, depthMm: 990, heightMm: 1020 });
    expect(calibratedFurnitureProxy(chair)).toBeDefined();
    expect(collisions(placed(doc, at(-100))).size).toBe(0);
    expect(collisions(placed(doc, at(250))).size).toBe(1);
    const from = { ...chair, x: 20000, y: 20000 }, target = { ...from, x: 20100, rotation: 90 };
    expect(constrainSeatingDrag(doc, from, target)).toEqual(target);
  });
  it('mantiene el barrido de modelos detallados dentro del presupuesto de interacción', () => {
    const { doc, at } = fixture(); const from = at(-100, 110), target = at(1600, 110);
    for (let i = 0; i < 100; i++) doc.furniture.push({ ...doc.furniture[0]!, id: `lejana-${i}`, x: 20000 + i * 3000 });
    for (let i = 0; i < 2; i++) constrainSeatingDrag(doc, from, target);
    const samples = Array.from({ length: 20 }, () => { const start = performance.now();
      constrainSeatingDrag(doc, from, target); return performance.now() - start; }).sort((a, b) => a - b);
    expect(samples[18]).toBeLessThan(100);
  });
  it('la vista Amueblado mantiene el tope en vista previa y al soltar; deshacer recupera el origen', () => {
    const { doc, at } = fixture();
    const from = at(-100, 110), store = createEditorStore(placed(doc, from)); store.getState().setSnap(false);
    const drag: PlanDrag = { id: from.id, item: from, start: { x: from.x, y: from.y }, pointerId: 1 };
    const point = at(1600, 110), preview = planDragPosition(drag, point, store) as Furniture;
    const final = planDragPosition(drag, point, store) as Furniture;
    expect(final.x).toBeCloseTo(preview.x); expect(final.y).toBeCloseTo(preview.y);
    store.getState().apply(updateFurniture(store.getState().document, from.id, { x: final.x, y: final.y }));
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document.furniture[1]).toEqual(from);
    store.getState().redo(); expect(store.getState().document.furniture[1]!.y).toBeCloseTo(final.y);
  });
});
