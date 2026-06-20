import { describe, it, expect } from 'vitest';
import { tokensToCredits, imageToCredits } from '@/server/billing/cost-to-credits';
import { estimateDeliverableCost, estimateIterationCost } from '@/server/billing/estimate-cost';
import { DEFAULT_PRICING } from '@/server/billing/pricing-table';

describe('cost-to-credits', () => {
  it('convierte tokens a créditos redondeando hacia arriba', () => {
    expect(tokensToCredits({ promptTokens: 1500, completionTokens: 500 })).toBe(2); // 2000/1000 * 1
    expect(tokensToCredits({ promptTokens: 100, completionTokens: 0 })).toBe(1); // mínimo 1
  });

  it('cobra una imagen por su tarifa por unidad', () => {
    expect(imageToCredits()).toBe(DEFAULT_PRICING.creditsPerImage);
  });
});

describe('estimate-cost (preview)', () => {
  it('un render incluye su base más el coste por imagen', () => {
    const expected = DEFAULT_PRICING.baseByDeliverable.render3d + DEFAULT_PRICING.creditsPerImage;
    expect(estimateDeliverableCost('render3d')).toBe(expected);
  });

  it('una memoria solo cuesta su base', () => {
    expect(estimateDeliverableCost('memoria')).toBe(DEFAULT_PRICING.baseByDeliverable.memoria);
  });

  it('una iteración de render cuesta el coste por imagen', () => {
    expect(estimateIterationCost('render3d')).toBe(DEFAULT_PRICING.creditsPerImage);
  });
});
