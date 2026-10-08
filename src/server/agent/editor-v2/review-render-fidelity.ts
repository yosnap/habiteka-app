import { RenderRejectedError } from '@/server/errors/render-rejected-error';
import { AiError } from '@/server/ai/errors';
import { assertRenderFidelity } from './render-fidelity-audit';
import { IncompleteRenderReviewError } from './render-fidelity-verdict';

/** Un descarte con evidencia se conserva para que el usuario pueda ver qué falló. */
export async function reviewRenderFidelity(...args: Parameters<typeof assertRenderFidelity>) {
  try { return { fidelity: await assertRenderFidelity(...args) }; }
  catch (error) {
    if (!(error instanceof RenderRejectedError) || !error.fidelity) throw error;
    return { fidelity: error.fidelity, review: { status: 'rejected' as const, reason: error.message, reviewedAt: error.fidelity.checkedAt } };
  }
}

/**
 * Si la revisión no llega a completarse (proveedores caídos, tope de gasto, rechazo, respuesta o informe incompletos),
 * la imagen ya está generada y cobrada: se guarda descartada con el motivo en vez de perderla. Sin revisión no puede
 * aceptarse. Un error de saneado de la imagen o de programación se relanza.
 */
export function unfinishedRenderReview(error: unknown) {
  const recoverable = error instanceof IncompleteRenderReviewError || (error instanceof AiError && error.kind !== 'sanitizer');
  if (!recoverable) throw error;
  const detail = (error instanceof Error ? error.message : String(error)).replace(/[.\s]+$/, '');
  return { review: { status: 'rejected' as const, source: 'automatic' as const, reviewedAt: new Date().toISOString(),
    reason: `La revisión visual no se completó (${detail}). La imagen se ha guardado para no perderla, pero no puede aceptarse sin revisión. Pulsa «Volver a revisar» al abrirla si es una cenital, frontal, trasera o lateral de toda la planta; si no, revísala con «Revisar un PNG externo».` } };
}
