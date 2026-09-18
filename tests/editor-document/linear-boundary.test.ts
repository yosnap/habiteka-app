import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { outdoorVolumes } from '@/lib/editor-document/outdoor-volumes';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { parseEditorDocument } from '@/lib/editor-document/validation';

it.each(['valla-madera', 'cerca-metal', 'seto'] as const)('dibuja 40m de %s como una entidad reversible y persistente', (kind) => {
  const source = emptyEditorDocument();
  const doc = addLinearBoundary(source, kind, { x: 1000, y: 2000 }, { x: 41000, y: 2000 });
  expect(doc.furniture).toHaveLength(1);
  const item = doc.furniture[0]!;
  expect(item.widthMm).toBe(40000);
  expect(localToWorld(item, { x: 0, y: item.depthMm / 2 })).toEqual({ x: 1000, y: 2000 });
  const volumes = outdoorVolumes(item);
  expect(volumes.length).toBeGreaterThan(40);
  const repeated = kind === 'seto' ? volumes : volumes.filter((v) => v.bottom === 0);
  expect(Math.max(...repeated.map((v) => v.widthMm))).toBeLessThanOrEqual(1000);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  const store = createEditorStore(source);
  store.getState().apply(doc); store.getState().undo();
  expect(store.getState().document).toEqual(source);
  store.getState().redo(); expect(store.getState().document).toEqual(doc);
});
it('respeta ambos extremos diagonales sin recentrar el tramo', () => {
  const item = addLinearBoundary(emptyEditorDocument(), 'valla-madera', { x: 100, y: 200 }, { x: 3100, y: 4200 }).furniture[0]!;
  expect(item.widthMm).toBe(5000);
  const end = localToWorld(item, { x: item.widthMm, y: item.depthMm / 2 });
  expect(end.x).toBeCloseTo(3100); expect(end.y).toBeCloseTo(4200);
});
it.each(['valla-madera', 'cerca-metal', 'seto'] as const)('admite esquinas de %s sin permitir duplicados ni cruces', (kind) => {
  const store = createEditorStore(emptyEditorDocument());
  const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }, { x: 0, y: 0 }];
  for (let i = 1; i < points.length; i++) store.getState().apply(addLinearBoundary(store.getState().document, kind, points[i - 1]!, points[i]!));
  expect(store.getState().document.furniture).toHaveLength(4);
  const current = store.getState().document;
  expect(() => store.getState().apply(addLinearBoundary(current, kind, points[0]!, points[1]!))).toThrow();
  expect(() => store.getState().apply(addLinearBoundary(current, kind, { x: 2000, y: -1000 }, { x: 2000, y: 1000 }))).toThrow();
});
