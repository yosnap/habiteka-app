import { describe, expect, it } from 'vitest';
import {
  levelLightBudgets,
  lightBudgetSplit,
  lightingCoverage,
  prioritizeByRoom,
  shadowLightIds,
  MAX_LUMINAIRE_LIGHTS,
  MAX_SHADOW_LIGHTS,
  MAX_STRIP_LIGHTS,
} from '@/components/editor-v2/scene/ceiling-scene-utils';

const luminaires = (count: number, roomId: string | null = null, prefix = 'light') =>
  Array.from({ length: count }, (_, index) => ({ luminaire: { id: `${prefix}-${index}`, enabled: true }, roomId }));
const strips = (count: number, roomId: string | null = null, prefix = 'strip') =>
  Array.from({ length: count }, (_, index) => ({ strip: { id: `${prefix}-${index}`, enabled: true }, lumens: 100 * (index + 1), roomId }));

describe('prioridad del presupuesto de luces por estancia', () => {
  it('enciende primero las luminarias de la estancia en la que está el usuario', () => {
    const split = lightBudgetSplit([...luminaires(12, 'otra'), ...luminaires(3, 'salon', 'salon')], [], MAX_LUMINAIRE_LIGHTS, 'salon');
    expect(split.luminaireIds.slice(0, 3)).toEqual(['salon-0', 'salon-1', 'salon-2']);
    expect(split.luminaireIds).toHaveLength(MAX_LUMINAIRE_LIGHTS);
  });

  it('las tiras de la estancia prioritaria entran aunque tengan menos lúmenes', () => {
    const split = lightBudgetSplit([], [...strips(6, 'otra'), { strip: { id: 'salon-tira', enabled: true }, lumens: 1, roomId: 'salon' }], MAX_LUMINAIRE_LIGHTS, 'salon');
    expect(split.stripIds[0]).toBe('salon-tira');
    expect(split.stripIds).toHaveLength(MAX_STRIP_LIGHTS);
  });

  it('sin estancia prioritaria el reparto no cambia', () => {
    expect(lightBudgetSplit(luminaires(4, 'salon'), strips(2, 'salon')))
      .toEqual(lightBudgetSplit(luminaires(4, 'salon'), strips(2, 'salon'), MAX_LUMINAIRE_LIGHTS, null));
  });

  it('la prioridad no rompe el tope global entre plantas', () => {
    const budgets = levelLightBudgets([
      { luminaires: luminaires(9, 'salon'), strips: strips(3, 'salon'), priorityRoomId: 'salon' },
      { luminaires: luminaires(9, null, 'otra'), strips: [] },
    ]);
    expect(budgets[0]).toBe(MAX_LUMINAIRE_LIGHTS);
    expect(budgets[1]).toBe(0);
  });

  it('ordena de forma estable dejando delante la estancia elegida', () => {
    const items = [{ roomId: 'a', id: 1 }, { roomId: 'b', id: 2 }, { roomId: 'a', id: 3 }];
    expect(prioritizeByRoom(items, 'a').map((item) => item.id)).toEqual([1, 3, 2]);
    expect(prioritizeByRoom(items, null).map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe('cobertura de luces reales', () => {
  it('cuenta cuántas encendidas iluminan de verdad', () => {
    expect(lightingCoverage([{ luminaires: luminaires(14), strips: strips(2) }]))
      .toEqual({ emitting: MAX_LUMINAIRE_LIGHTS, enabled: 16 });
  });

  it('sin exceso, todas las encendidas iluminan', () => {
    expect(lightingCoverage([{ luminaires: luminaires(3), strips: strips(1) }]))
      .toEqual({ emitting: 4, enabled: 4 });
  });

  it('una luz apagada no cuenta como encendida', () => {
    const coverage = lightingCoverage([{
      luminaires: [{ luminaire: { id: 'a', enabled: true }, effectiveEnabled: false }],
      strips: [],
    }]);
    expect(coverage).toEqual({ emitting: 0, enabled: 0 });
  });
});

describe('reparto de sombras', () => {
  it('solo las primeras luces del orden de prioridad proyectan sombra', () => {
    expect(shadowLightIds(['salon-0', 'salon-1', 'otra-0', 'otra-1'])).toEqual(['salon-0', 'salon-1']);
    expect(MAX_SHADOW_LIGHTS).toBeLessThanOrEqual(2);
  });

  it('una planta secundaria puede quedarse sin sombras', () => {
    expect(shadowLightIds(['a', 'b'], 0)).toEqual([]);
  });
});
