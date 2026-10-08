import { describe, expect, it } from 'vitest';
import { validateVisitRegionEdit, visitRegionPrompt } from '@/server/walkthrough/property-visit-region';
const edit = { sourceId: 'draft', instruction: 'Retira los muebles inventados del fondo', eraseZone: true,
  zone: { id: 'door', bbox: { x: .4, y: .3, width: .1, height: .3 } } };
describe('corrección localizada del paseo', () => {
  it('vincula la selección al borrador exacto y rechaza otro o ninguno', () => {
    expect(validateVisitRegionEdit(edit, 'draft')).toEqual(edit);
    expect(() => validateVisitRegionEdit(edit, 'other')).toThrow('último borrador');
    expect(() => validateVisitRegionEdit(edit)).toThrow('último borrador');
    expect(validateVisitRegionEdit(undefined)).toBeUndefined();
  });
  it.each([
    { ...edit, zone: { id: 'all', bbox: { x: 0, y: 0, width: 1, height: 1 } } },
    { ...edit, zone: { id: 'invalid', bbox: { x: 1, y: 0, width: .2, height: .2 } } },
    { ...edit, zone: { ...edit.zone, maskRef: 'external-mask' } },
    { ...edit, eraseZone: 'true' },
  ])('rechaza entradas inválidas antes del proveedor', value => {
    expect(() => validateVisitRegionEdit(value, 'draft')).toThrow();
  });
  it('distingue el borrador de los diseños aceptados e incluye geometría y lectura previa', () => {
    const prompt = visitRegionPrompt(edit, ['Paso vacío'], { depth: 1295 });
    expect(prompt).toContain('not an accepted design');
    expect(prompt).toContain('Paso vacío'); expect(prompt).toContain('1295');
    expect(prompt).not.toContain('Image 2');
  });
});
