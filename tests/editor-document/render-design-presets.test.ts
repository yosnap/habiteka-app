import { describe, expect, it } from 'vitest';
import { readRenderPresets, transferableRenderOptions } from '@/lib/editor-document/render-design-presets';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

describe('configuración reutilizable', () => {
  it('conserva instrucciones y permisos, descartando identidades y coordenadas del inmueble anterior', () => {
    const options = { ...defaultRenderDesignOptions(), designScope: 'rooms' as const, designRoomIds: ['old-room'],
      interiorRoomIds: ['old-room'], designStructureIds: ['old-stair'], designZoneId: 'old-zone',
      regions: [{ id: 'old', name: 'Vieja', polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }],
      redesignFixed: true, lighting: 'warm' as const };
    const reusable = transferableRenderOptions(options);
    expect(reusable).toMatchObject({ designScope: 'all', placement: 'all', regions: [], interiorRoomIds: [],
      designRoomIds: [], designStructureIds: [], designZoneId: '', redesignFixed: true, lighting: 'warm' });
    const presets = readRenderPresets(JSON.stringify([{ name: 'Casa', style: 'moderno', objective: '',
      instruction: 'Acabados cálidos', intent: 'editable', options }]));
    expect(presets[0]?.instruction).toBe('Acabados cálidos');
    expect(presets[0]?.options).toEqual(reusable);
  });
  it('tolera almacenamiento corrupto y rechaza preferencias fuera de contrato', () => {
    expect(readRenderPresets('{')).toEqual([]);
    expect(readRenderPresets(JSON.stringify([{ name: 'a', style: 'inventado' }]))).toEqual([]);
  });
});
