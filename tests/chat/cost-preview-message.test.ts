import { describe, it, expect } from 'vitest';
import { costPreviewMessage } from '@/components/chat/cost-preview-message';

describe('costPreviewMessage — refleja la decisión de la facturación', () => {
  it('entregable nuevo: siempre muestra coste en créditos (no gratis)', () => {
    const r = costPreviewMessage({
      isNewDeliverable: true,
      freeIterationsRemaining: 5,
      freeIterationsTotal: 5,
      estimateCredits: 30,
    });
    expect(r.free).toBe(false);
    expect(r.message).toContain('30 créditos');
  });

  it('iteración con cupo gratis restante: muestra gratis con K de N', () => {
    const r = costPreviewMessage({
      isNewDeliverable: false,
      freeIterationsRemaining: 2,
      freeIterationsTotal: 3,
      estimateCredits: 10,
    });
    expect(r.free).toBe(true);
    expect(r.message).toContain('2 de 3');
  });

  it('iteración con cupo agotado: muestra coste en créditos', () => {
    const r = costPreviewMessage({
      isNewDeliverable: false,
      freeIterationsRemaining: 0,
      freeIterationsTotal: 3,
      estimateCredits: 10,
    });
    expect(r.free).toBe(false);
    expect(r.message).toContain('10 créditos');
  });
});
