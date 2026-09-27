import { expect, it } from 'vitest';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { allowedProposalFurniture, polygonContainsFootprint } from '@/lib/editor-document/proposal-permissions';
import { parseNativeDesignProposal, proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';
import type { ChatVisionAdapter } from '@/lib/contracts';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';

const item = { catalogId: 'habiteka:furniture:planta', xMm: 1000, yMm: 1000, rotation: 0, reason: 'Vegetación' };
const options = defaultRenderDesignOptions();
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
  expect(parseNativeDesignProposal(raw, 'moderno', doc, options).furniture).toEqual([]);
  expect(parseNativeDesignProposal(raw, 'moderno', doc, { ...options, freedom: 'controlled', additions: ['plants'] }).furniture).toEqual([item]);
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
