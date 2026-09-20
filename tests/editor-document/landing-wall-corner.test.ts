import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addRamp } from '@/lib/editor-document/construction-commands';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { nudgeElements } from '@/canvas/editor-v2/nudge-elements';

// Muro vertical que termina en (2000, 3000) y muro horizontal que arranca ahí: la esquina donde el descansillo quiere apoyar.
const corner = () => addWallPath(emptyEditorDocument(), [{ x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 6000, y: 3000 }]);
const landing = (x: number, y: number) => ({ id: 'descanso', catalogId: 'builtin:ramp-landing', x, y, widthMm: 1000, depthMm: 1200,
  elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });

it('un descansillo puede abrazar la esquina de un muro sin que cuente como colisión', () => {
  const doc = corner(), t = doc.walls[0]!.thicknessMm;
  // Pegado por la izquierda del muro vertical y con el borde superior 40 mm por encima del vértice: toca los dos extremos.
  const store = createEditorStore(addRamp(doc, landing(2000 - t / 2 - 1000 + 60, 3000 - 40)));
  expect(store.getState().document.ramps).toHaveLength(1);
  // Empujarlo 200 mm más hacia la esquina sigue permitido (dentro de dos grosores del extremo).
  expect(() => store.getState().apply(nudgeElements(store.getState().document, ['descanso'], { x: 200, y: 0 }))).not.toThrow();
});

it('invadir el tramo intermedio de un muro sigue estando prohibido', () => {
  const doc = corner(), t = doc.walls[0]!.thicknessMm;
  const store = createEditorStore(addRamp(doc, landing(2000 - t / 2 - 1000, 500)));
  expect(() => store.getState().apply(nudgeElements(store.getState().document, ['descanso'], { x: 120, y: 0 }))).toThrow(/atraviesa/);
});
