import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addRamp, updateRamp } from '@/lib/editor-document/construction-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { editorDesignContext } from '@/lib/editor-document/design-context';

it('guarda el acabado lateral de la rampa y conserva pendiente y pavimento', () => {
  const source = addRamp(emptyEditorDocument(), {
    id: 'rampa', catalogId: 'builtin:ramp-straight', x: 1000, y: 2000,
    widthMm: 1200, depthMm: 4000, riseMm: 1000, elevationMm: 0,
    rotation: 180, materialId: 'polyhaven:brushed_concrete',
  });
  const changed = updateRamp(source, 'rampa', { bodyMaterialId: 'polyhaven:white_plaster_02' });
  const saved = parseEditorDocument(JSON.parse(JSON.stringify(changed)));
  const ramp = saved.ramps![0]!;
  const mesh = editorDocumentToScene(saved).ramps[0]!;
  const render = buildEditorRenderContract(saved).elements.find((element) => element.sourceId === 'rampa')!;

  expect(ramp).toMatchObject({ depthMm: 4000, riseMm: 1000, materialId: 'polyhaven:brushed_concrete',
    bodyMaterialId: 'polyhaven:white_plaster_02' });
  expect(mesh).toMatchObject({ rise: 1, baseHeight: 0, bodyMaterialId: 'polyhaven:white_plaster_02',
    floorFinish: { texture: 'polyhaven:brushed_concrete' } });
  expect(render.attributes?.['acabado de laterales y cara inferior']).toBe('Pintura blanca lisa');
  expect(editorDesignContext(saved).existingMaterialPalette.rampBodies).toContain('polyhaven:white_plaster_02');
});
