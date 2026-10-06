import { expect, it } from 'vitest';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { addStair, updateStair } from '@/lib/editor-document/construction-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { stairMeshes } from '@/canvas/editor-v2/scene/stair-meshes';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { editorDesignContext } from '@/lib/editor-document/design-context';

const stair: Stair = {
  id: 'escalera', catalogId: 'builtin:stairs-straight', kind: 'straight', x: 1000, y: 2000,
  widthMm: 1200, depthMm: 4000, heightMm: 1000, elevationMm: 0, rotation: 180,
  stepCount: 8, materialId: 'polyhaven:brushed_concrete',
};

it('guarda el cuerpo de la escalera sin alterar huellas ni medidas y lo comparte con la escena y el render', () => {
  const source = addStair(emptyEditorDocument(), stair);
  const changed = updateStair(source, stair.id, { bodyMaterialId: 'polyhaven:white_plaster_02' });
  const saved = parseEditorDocument(JSON.parse(JSON.stringify(changed)));
  const steps = editorDocumentToScene(saved).boxes.filter((box) => box.sourceEntityId === stair.id && box.role === 'step');
  const render = buildEditorRenderContract(saved).elements.find((element) => element.sourceId === stair.id)!;

  expect(saved.stairs![0]).toMatchObject({ widthMm: 1200, heightMm: 1000, stepCount: 8,
    materialId: 'polyhaven:brushed_concrete', bodyMaterialId: 'polyhaven:white_plaster_02' });
  expect(steps.length).toBeGreaterThan(1);
  expect(steps.every((box) => box.topMaterialId === 'polyhaven:brushed_concrete'
    && box.bodyMaterialId === 'polyhaven:white_plaster_02')).toBe(true);
  expect(render.attributes?.['acabado de contrahuellas, laterales y cara inferior']).toBe('Pintura blanca lisa');
  expect(editorDesignContext(saved).existingMaterialPalette.stairBodies).toContain('polyhaven:white_plaster_02');
  expect(updateStair(saved, stair.id, { bodyMaterialId: undefined }).stairs![0]!.bodyMaterialId).toBeUndefined();
});

it('rechaza un acabado desconocido y mantiene el aspecto anterior de escaleras sin acabado de cuerpo', () => {
  const source = addStair(emptyEditorDocument(), stair);
  expect(() => parseEditorDocument({ ...source, stairs: [{ ...source.stairs![0], bodyMaterialId: 'unknown' }] }))
    .toThrow('Acabado del cuerpo de la escalera inválido');
  expect(stairMeshes(source.stairs![0]!).filter((box) => box.role === 'step')
    .every((box) => box.bodyMaterialId === undefined)).toBe(true);
});
