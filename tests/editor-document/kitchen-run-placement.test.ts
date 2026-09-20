import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { orientKitchenRun, snapToWallFace } from '@/lib/editor-document/kitchen-run-placement';
import { addKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { localToWorld } from '@/lib/editor-document/spatial-properties';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);

it('el imán lleva el punto a la cara interior del muro más cercano y devuelve la normal hacia la estancia', () => {
  const doc = house(), half = doc.walls[0]!.thicknessMm / 2;
  const hit = snapToWallFace(doc, { x: 2000, y: half + 120 }, 200)!;
  expect(hit.point.x).toBeCloseTo(2000); expect(hit.point.y).toBeCloseTo(half);
  expect(hit.normal.x).toBeCloseTo(0); expect(hit.normal.y).toBeCloseTo(1);
  expect(snapToWallFace(doc, { x: 2000, y: 2000 }, 200)).toBeNull();
  const outside = snapToWallFace(doc, { x: 2000, y: -half - 50 }, 200)!;
  expect(outside.normal.y).toBeCloseTo(-1);
});

it('el cuerpo cae siempre hacia la estancia, se trace el tramo en un sentido o en el otro', () => {
  const source = house(), half = source.walls[0]!.thicknessMm / 2;
  for (const [from, to] of [[{ x: half + 500, y: half }, { x: half + 3500, y: half }], [{ x: half + 3500, y: half }, { x: half + 500, y: half }]] as const) {
    const store = createEditorStore(source);
    store.getState().apply(addKitchenRun(source, ...orientKitchenRun(source, from, to, 400)));
    const run = store.getState().document.kitchenRuns![0]!, front = localToWorld(run, { x: run.widthMm / 2, y: run.depthMm });
    expect(front.y).toBeCloseTo(half + 600);
  }
  // Por el muro oeste el cuerpo debe caer hacia +x.
  const store = createEditorStore(source);
  store.getState().apply(addKitchenRun(source, ...orientKitchenRun(source, { x: half, y: half + 500 }, { x: half, y: half + 3000 }, 400)));
  const west = store.getState().document.kitchenRuns![0]!;
  expect(localToWorld(west, { x: 0, y: west.depthMm }).x).toBeCloseTo(half + 600);
  // Lejos de cualquier muro se respeta el orden dibujado.
  expect(orientKitchenRun(source, { x: 2000, y: 2000 }, { x: 4000, y: 2000 }, 400)).toEqual([{ x: 2000, y: 2000 }, { x: 4000, y: 2000 }]);
});
