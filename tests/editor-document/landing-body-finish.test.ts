import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addRamp, updateRamp } from '@/lib/editor-document/construction-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { editorDesignContext } from '@/lib/editor-document/design-context';

const landing = {
  id: 'landing', catalogId: 'builtin:ramp-landing', x: 1000, y: 2000,
  widthMm: 1800, depthMm: 1200, riseMm: 0, elevationMm: 1000,
  rotation: 180, materialId: 'concrete-grey',
};

describe('acabado del cuerpo del descansillo', () => {
  it('persiste, llega a la escena y al contrato de imagen sin cambiar la superficie transitable', () => {
    const source = addRamp(emptyEditorDocument(), landing);
    const changed = updateRamp(source, landing.id, { bodyMaterialId: 'polyhaven:white_plaster_02' });
    const saved = parseEditorDocument(JSON.parse(JSON.stringify(changed)));
    const ramp = saved.ramps![0]!;
    const mesh = editorDocumentToScene(saved).ramps[0]!;
    const render = buildEditorRenderContract(saved).elements.find((element) => element.sourceId === landing.id)!;

    expect(ramp).toMatchObject({ materialId: 'concrete-grey', bodyMaterialId: 'polyhaven:white_plaster_02', elevationMm: 1000 });
    expect(mesh).toMatchObject({ baseHeight: 1, bodyMaterialId: 'polyhaven:white_plaster_02', floorFinish: { texture: 'none' } });
    expect(render.attributes?.['acabado del canto y cara inferior']).toBe('Pintura blanca lisa');
    expect(editorDesignContext(saved).existingMaterialPalette.landingBodies).toContain('polyhaven:white_plaster_02');
    expect(render.dimensions?.elevation).toBe(1);
    expect(updateRamp(saved, landing.id, { bodyMaterialId: undefined }).ramps![0]!.bodyMaterialId).toBeUndefined();
  });

  it('rechaza un material desconocido', () => {
    const doc = addRamp(emptyEditorDocument(), landing);
    expect(() => parseEditorDocument({ ...doc, ramps: [{ ...doc.ramps![0], bodyMaterialId: 'unknown' }] })).toThrow('Acabado');
  });
});
