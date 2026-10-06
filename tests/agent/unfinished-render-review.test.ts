/** Una imagen ya cobrada no se pierde porque los modelos de Análisis visual no respondan. */
import { describe, expect, it } from 'vitest';
import { aiError } from '@/server/ai/errors';
import { unfinishedRenderReview } from '@/server/agent/editor-v2/review-render-fidelity';
import { renderReviewIssue } from '@/lib/editor-document/render-review';
import { IncompleteRenderReviewError } from '@/server/agent/editor-v2/render-fidelity-verdict';

describe('revisión visual sin respuesta del proveedor', () => {
  it('guarda la imagen descartada con el motivo y sin permitir aceptarla', () => {
    const { review } = unfinishedRenderReview(aiError('timeout', 'Ningún modelo configurado respondió. nan · qwen: El modelo no respondió en 3 minutos'));
    expect(review.status).toBe('rejected');
    expect(review.reason).toContain('La revisión visual no se completó (Ningún modelo configurado respondió');
    expect(review.reason).toContain('Revisar un PNG externo');
    expect(renderReviewIssue({ review })).toBe(review.reason);
  });

  it('también conserva la imagen si la revisión se rechaza o alcanza el tope de gasto', () => {
    expect(unfinishedRenderReview(aiError('refusal', 'contenido no permitido')).review.status).toBe('rejected');
    expect(unfinishedRenderReview(aiError('spend_cap', 'tope diario alcanzado')).review.reason).toContain('tope diario alcanzado');
  });

  it('conserva la imagen si el auditor devuelve un informe incompleto', () => {
    const { review } = unfinishedRenderReview(new IncompleteRenderReviewError('La revisión no comprobó todo el terreno, los cerramientos y los objetos exteriores.'));
    expect(review.reason).toContain('no comprobó todo el terreno');
  });

  it('relanza los errores de saneado y de programación', () => {
    expect(() => unfinishedRenderReview(new Error('fallo de programación'))).toThrow('fallo de programación');
    expect(() => unfinishedRenderReview(aiError('sanitizer', 'imagen ilegible'))).toThrow('imagen ilegible');
  });
});
