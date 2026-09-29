import { expect, it } from 'vitest';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { allowedProposalFurniture, polygonContainsFootprint } from '@/lib/editor-document/proposal-permissions';
import { NATIVE_DESIGN_SCHEMA, parseNativeDesignProposal, proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';
import type { ChatVisionAdapter } from '@/lib/contracts';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

const item = { catalogId: 'habiteka:furniture:planta', xMm: 1000, yMm: 1000, rotation: 0, reason: 'Vegetación' };
const options = defaultRenderDesignOptions();
it('valida el acabado opcional del canto y exige una salida estructurada completa', () => {
  const doc = emptyEditorDocument();
  expect(NATIVE_DESIGN_SCHEMA.properties?.materials?.required).toContain('slabUndersides');
  expect(NATIVE_DESIGN_SCHEMA.properties?.materials?.required).toContain('stairBodies');
  expect(NATIVE_DESIGN_SCHEMA.properties?.materials?.required).toContain('landingBodies');
  expect(NATIVE_DESIGN_SCHEMA.properties?.materials?.required).toContain('rampBodies');
  const base = { summary: 'Terraza', furniture: [], materials: { slabUndersides: 'polyhaven:brushed_concrete', stairBodies: 'polyhaven:white_plaster_02', rampBodies: 'polyhaven:white_plaster_02', landingBodies: 'polyhaven:white_plaster_02' } };
  expect(parseNativeDesignProposal(base, 'moderno', doc, options).materials.slabUndersides).toBe('polyhaven:brushed_concrete');
  expect(parseNativeDesignProposal(base, 'moderno', doc, options).materials.stairBodies).toBe('polyhaven:white_plaster_02');
  expect(parseNativeDesignProposal(base, 'moderno', doc, options).materials.rampBodies).toBe('polyhaven:white_plaster_02');
  expect(parseNativeDesignProposal(base, 'moderno', doc, options).materials.landingBodies).toBe('polyhaven:white_plaster_02');
  expect(parseNativeDesignProposal({ ...base, materials: { slabUndersides: 'none' } }, 'moderno', doc, options).materials.slabUndersides).toBeUndefined();
  expect(parseNativeDesignProposal({ ...base, materials: { landingBodies: 'none' } }, 'moderno', doc, options).materials.landingBodies).toBeUndefined();
});
it('valida permisos antes de consultar al proveedor', async () => {
  let called = false;
  const chat: ChatVisionAdapter = {
    chat: async () => { called = true; throw new Error('No debe llamarse'); },
    chatStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
  };
  await expect(proposeNativeDesign(chat, emptyEditorDocument(), 'moderno', '', '', [], {
    ...options, freedom: 'controlled', placement: 'selected', regions: [],
  })).rejects.toThrow('Marca al menos una zona');
  expect(called).toBe(false);
});
it('rechaza un estilo incompatible por zona antes de consultar al proveedor', async () => {
  let called = false;
  const chat: ChatVisionAdapter = {
    chat: async () => { called = true; throw new Error('No debe llamarse'); },
    chatStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
  };
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  await expect(proposeNativeDesign(chat, { ...source, designStyle: 'moderno' }, 'clasico', '', '', [], {
    ...options, designScope: 'interior',
  })).rejects.toThrow('ya tiene otro estilo');
  expect(called).toBe(false);
});
it('estricto impide objetos aunque el modelo los devuelva', () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const raw = { summary: 'Plantas', materials: {}, furniture: [item] };
  const strict = parseNativeDesignProposal(raw, 'moderno', doc, options);
  expect(strict.furniture).toEqual([]);
  expect(strict.summary).toContain('Se descartaron 1 objeto(s)');
  expect(strict.summary).toContain('categoría no permitida');
  expect(strict.summary).not.toContain('Plantas');
  expect(parseNativeDesignProposal(raw, 'moderno', doc, { ...options, freedom: 'controlled', additions: ['plants'] }).furniture).toEqual([item]);
});

it('explica qué objeto choca con otro mueble en una propuesta editable', () => {
  const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(),
    [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true));
  doc.furniture.push({ id: 'mesa', kind: 'mesa-comedor', catalogId: 'habiteka:furniture:mesa-comedor',
    x: 1000, y: 1000, widthMm: 1600, depthMm: 900, heightMm: 750, elevationMm: 0,
    rotation: 0, dimensionalOrigin: 'physical', color: '#b89364' });
  const sofa = { catalogId: 'habiteka:furniture:sofa-2', xMm: 1100, yMm: 1100,
    rotation: 0, reason: 'Asiento' };
  const result = parseNativeDesignProposal({ materials: {}, furniture: [sofa] }, 'moderno', doc,
    { ...options, freedom: 'controlled', additions: ['furniture'] });
  expect(result.furniture).toEqual([]);
  expect(result.summary).toContain('Sofá de dos plazas: solapa la zona de seguridad de un mueble o estructura');
});
it('descarta muebles propuestos fuera del ámbito editable aunque el modelo los devuelva', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const doc = addOutdoorArea(house, { x: 6000, y: 0 }, { x: 9000, y: 4000 });
  const raw = { summary: 'Exterior', materials: {}, furniture: [item] };
  expect(parseNativeDesignProposal(raw, 'moderno', doc, { ...options, freedom: 'free', designScope: 'exterior' }).furniture).toEqual([]);
  expect(parseNativeDesignProposal(raw, 'moderno', doc, { ...options, freedom: 'free', designScope: 'interior' }).furniture).toEqual([item]);
});
it('controlado permite solo categorías marcadas; libre no permite instalaciones', () => {
  expect(allowedProposalFurniture(item, { ...options, freedom: 'controlled', additions: ['lights'] })).toBe(false);
  expect(allowedProposalFurniture(item, { ...options, freedom: 'controlled', additions: ['plants'] })).toBe(true);
  expect(allowedProposalFurniture(item, { ...options, freedom: 'free' })).toBe(true);
  expect(allowedProposalFurniture({ ...item, catalogId: 'habiteka:furniture:ducha' }, { ...options, freedom: 'free' })).toBe(false);
});
it('permite un asiento exterior y una tira LED funcional solo con sus permisos', () => {
  const seat = { ...item, catalogId: 'habiteka:outdoor:puf-exterior' };
  const led = { ...item, catalogId: 'habiteka:outdoor:tira-led' };
  expect(allowedProposalFurniture(seat, { ...options, freedom: 'controlled', additions: ['furniture'] })).toBe(true);
  expect(allowedProposalFurniture(led, { ...options, freedom: 'controlled', additions: ['furniture'] })).toBe(false);
  expect(allowedProposalFurniture(led, { ...options, freedom: 'controlled', additions: ['lights'] })).toBe(true);
});
it('comprueba toda la huella de objetos, no solo su origen', () => {
  const region = { id: 'a', name: 'Zona', polygon: [{ x: 900, y: 900 }, { x: 1400, y: 900 }, { x: 1400, y: 1400 }, { x: 900, y: 1400 }] };
  expect(allowedProposalFurniture(item, { ...options, freedom: 'free', placement: 'selected', regions: [region] })).toBe(false);
  expect(allowedProposalFurniture(item, { ...options, freedom: 'free', placement: 'selected', regions: [] })).toBe(false);
});
it('rechaza una huella que cruza una muesca cóncava aunque sus cuatro esquinas estén dentro', () => {
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
  expect(polygonContainsFootprint(polygon, [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }])).toBe(false);
  expect(polygonContainsFootprint(polygon, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }])).toBe(true);
});
