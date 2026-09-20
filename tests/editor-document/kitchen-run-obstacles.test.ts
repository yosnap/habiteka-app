import { expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addColumn } from '@/lib/editor-document/construction-commands';
import { addKitchenRun, addKitchenSlot, updateKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { kitchenRunObstacles } from '@/lib/editor-document/kitchen-run-obstacles';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { kitchenSlotDrop, slotKindFor } from '@/lib/editor-document/kitchen-slot-drop';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { createEditorStore } from '@/canvas/editor-v2/store';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
const face = (doc: EditorDocument) => doc.walls[0]!.thicknessMm / 2;
const withRun = (doc: EditorDocument, uppers = false) => {
  let next = addKitchenRun(doc, { x: face(doc), y: face(doc) }, { x: face(doc) + 4000, y: face(doc) });
  const run = next.kitchenRuns![0]!;
  if (uppers) next = updateKitchenRun(next, run.id, { kitchen: { ...run.kitchen, uppers: { bottomMm: 1450, heightMm: 700, depthMm: 350, color: '#f1eee6' } } });
  return next;
};
const column = (doc: EditorDocument, x: number, depthMm: number) => addColumn(doc, { id: `pilar-${x}`, catalogId: 'builtin:column-rectangular', x, y: face(doc), widthMm: 300, depthMm,
  heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });

it('un pilar sobre el tramo vacía bajos y altos en su huella y la encimera continúa por delante', () => {
  let doc = withRun(house(), true); const t = face(doc);
  doc = column(doc, t + 1500, 300);
  const run = doc.kitchenRuns![0]!, cuts = kitchenRunObstacles(doc, run);
  expect(cuts.base).toEqual([{ from: 1500, to: 1800 }]); expect(cuts.uppers).toEqual([{ from: 1500, to: 1800 }]);
  expect(cuts.worktop).toEqual([]); expect(cuts.worktopNotches).toEqual([{ from: 1500, to: 1800, depthMm: 300 }]);
  const volumes = furnitureVolumes(run, doc);
  const at = (x: number) => volumes.filter((v) => v.x < x && v.x + v.widthMm > x);
  expect(at(1650).filter((v) => v.bottom < 870 && v.top > 100)).toHaveLength(0);
  const strip = at(1650).find((v) => v.top === 900)!;
  expect(strip.y).toBe(300); expect(strip.depthMm).toBe(300);
  expect(at(1650).filter((v) => v.bottom >= 1450)).toHaveLength(0);
  expect(at(800).some((v) => v.bottom >= 1450)).toBe(true);
  // Con el pilar en la colocación real no hay error de colisión.
  expect(() => createEditorStore(withRun(house(), true)).getState().apply(column(withRun(house(), true), t + 1500, 300))).not.toThrow();
});

it('un pilar que ocupa todo el fondo interrumpe la encimera', () => {
  let doc = withRun(house()); doc = column(doc, face(doc) + 2000, 700);
  const cuts = kitchenRunObstacles(doc, doc.kitchenRuns![0]!);
  expect(cuts.worktop).toEqual([{ from: 2000, to: 2300 }]); expect(cuts.worktopNotches).toEqual([]);
});

it('los módulos altos se omiten sobre la ventana del muro de apoyo', () => {
  let doc = withRun(house(), true);
  doc = addOpening(doc, doc.walls[0]!.id, { x: face(doc) + 2000, y: 0 }, 'ventana');
  const run = doc.kitchenRuns![0]!, cuts = kitchenRunObstacles(doc, run), window = doc.openings[0]!;
  expect(cuts.uppers).toHaveLength(1);
  expect(cuts.uppers[0]!.to - cuts.uppers[0]!.from).toBeCloseTo(window.widthMm);
  expect(cuts.base).toEqual([]);
  const volumes = furnitureVolumes(run, doc);
  expect(volumes.filter((v) => v.bottom >= 1450 && v.x < 2000 && v.x + v.widthMm > 2000)).toHaveLength(0);
  expect(volumes.some((v) => v.bottom >= 1450)).toBe(true);
});

it('un aparato no puede caer sobre el hueco de un pilar y al añadir sin posición se busca otro sitio', () => {
  let doc = withRun(house()); doc = column(doc, face(doc) + 2000, 300);
  const id = doc.kitchenRuns![0]!.id;
  expect(() => addKitchenSlot(doc, id, 'horno', 2100)).toThrow(/pilar/);
  const added = addKitchenSlot(doc, id, 'horno');
  const slot = added.kitchenRuns![0]!.kitchen.slots[0]!;
  expect(slot.positionMm + slot.widthMm / 2 <= 2000 || slot.positionMm - slot.widthMm / 2 >= 2300).toBe(true);
});

it('un aparato del catálogo soltado sobre el tramo se encaja como hueco', () => {
  const doc = withRun(house()), run = doc.kitchenRuns![0]!, inside = localToWorld(run, { x: 1200, y: 300 });
  expect(slotKindFor({ kind: 'asset-nevera' })).toBe('frigorifico-columna');
  expect(slotKindFor({ kind: 'sofa-3' })).toBeUndefined();
  expect(kitchenSlotDrop(doc, { kind: 'lavavajillas' }, inside)).toEqual({ runId: run.id, kind: 'lavavajillas', positionMm: 1200 });
  expect(kitchenSlotDrop(doc, { kind: 'lavavajillas' }, { x: 4000, y: 3000 })).toBeNull();
});
