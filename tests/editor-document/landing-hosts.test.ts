import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addRamp, addStair, updateRamp } from '@/lib/editor-document/construction-commands';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { rampArrival } from '@/lib/editor-document/ramp-arrival';

/** Rampa y escalera contiguas que llegan hacia el norte, a 1,00 m; descansillo rematándolas. */
function combined() {
  let doc = addRamp(emptyEditorDocument(), { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 0, y: 4000, widthMm: 1000, depthMm: 4000, riseMm: 1000, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
  doc = addStair(doc, { id: 'stair', kind: 'straight', catalogId: 'stair-straight', x: 1000, y: 4000, widthMm: 900, depthMm: 2500, heightMm: 1000, elevationMm: 0, rotation: 0, stepCount: 6, materialId: 'wood-oak' });
  return addRamp(doc, { id: 'landing', catalogId: 'builtin:ramp-landing', x: 0, y: 2500, widthMm: 1900, depthMm: 1500, elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });
}

it('un descansillo redimensionado remata a la vez la rampa y la escalera contiguas', () => {
  const doc = combined(), arrival = rampArrival(doc.ramps!.find((r) => r.id === 'ramp')!);
  expect(arrival.point.y).toBe(4000);
  const resized = updateRamp(doc, 'landing', { depthMm: 1200 });
  const landing = resized.ramps!.find((r) => r.id === 'landing')!;
  // La anchura cubre las dos llegadas (1000 + 900) y sigue a ras de ambas.
  expect(landing.widthMm).toBe(1900);
  expect(landing.x).toBe(0);
  expect(landing.y).toBeCloseTo(4000 - 1200, 6);
  expect(landing.elevationMm).toBe(1000);
});

it('una valla que cruza un descansillo se apoya encima sin retranquearse; sobre el borde se retranquea', () => {
  const store = createEditorStore(combined());
  store.getState().apply(addLinearBoundary(store.getState().document, 'valla-madera', { x: -300, y: 3200 }, { x: 2200, y: 3200 }));
  const across = store.getState().document.boundaries!.at(-1)!;
  expect(across.elevationMm).toBe(1000);
  expect(across.widthMm).toBe(2500);
  store.getState().apply(addLinearBoundary(store.getState().document, 'valla-madera', { x: 0, y: 2500 }, { x: 1900, y: 2500 }));
  const alongEdge = store.getState().document.boundaries!.at(-1)!;
  expect(alongEdge.elevationMm).toBe(1000);
  // El eje queda medio espesor dentro del borde: el cuerpo entero sobre la losa.
  expect(alongEdge.y + alongEdge.depthMm / 2).toBeCloseTo(2500 + alongEdge.depthMm / 2, 6);
  expect(alongEdge.y).toBeGreaterThanOrEqual(2500);
});
