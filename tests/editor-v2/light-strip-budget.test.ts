import { describe, expect, it } from 'vitest';
import { lightBudgetSplit, MAX_LUMINAIRE_LIGHTS, MAX_STRIP_LIGHTS } from '@/components/editor-v2/scene/ceiling-scene-utils';

const luminaires = (count: number, enabled = true) =>
  Array.from({ length: count }, (_, index) => ({ luminaire: { id: `light-${index}`, enabled } }));
const strips = (count: number, enabled = true) =>
  Array.from({ length: count }, (_, index) => ({ strip: { id: `strip-${index}`, enabled }, lumens: 100 * (index + 1) }));

describe('reparto del presupuesto de luces reales', () => {
  it('nunca supera el presupuesto global con muchas luminarias y tiras', () => {
    const split = lightBudgetSplit(luminaires(20), strips(6));
    expect(split.stripIds).toHaveLength(MAX_STRIP_LIGHTS);
    expect(split.luminaireIds).toHaveLength(8);
    expect(split.luminaireIds.length + split.stripIds.length).toBe(MAX_LUMINAIRE_LIGHTS);
  });

  it('con pocas luces no recorta nada', () => {
    const split = lightBudgetSplit(luminaires(3), strips(1));
    expect(split.luminaireIds).toHaveLength(3);
    expect(split.stripIds).toHaveLength(1);
  });

  it('las tiras entran por lúmenes descendentes', () => {
    expect(lightBudgetSplit(luminaires(0), strips(6)).stripIds)
      .toEqual(['strip-5', 'strip-4', 'strip-3', 'strip-2']);
  });

  it('una tira apagada no consume presupuesto', () => {
    const split = lightBudgetSplit(luminaires(12), strips(3, false));
    expect(split.stripIds).toEqual([]);
    expect(split.luminaireIds).toHaveLength(MAX_LUMINAIRE_LIGHTS);
  });

  it('una luminaria apagada tampoco', () => {
    expect(lightBudgetSplit(luminaires(4, false), strips(1)).luminaireIds).toEqual([]);
  });

  it('respeta un presupuesto reducido', () => {
    const split = lightBudgetSplit(luminaires(10), strips(10), 3);
    expect(split.stripIds).toHaveLength(3);
    expect(split.luminaireIds).toHaveLength(0);
  });
});
