import { RenderRejectedError } from '@/server/errors/render-rejected-error';
import { assertRenderFidelity } from './render-fidelity-audit';

/** Un descarte con evidencia se conserva para que el usuario pueda ver qué falló. */
export async function reviewRenderFidelity(...args: Parameters<typeof assertRenderFidelity>) {
  try { return { fidelity: await assertRenderFidelity(...args) }; }
  catch (error) {
    if (!(error instanceof RenderRejectedError) || !error.fidelity) throw error;
    return { fidelity: error.fidelity, review: { status: 'rejected' as const, reason: error.message, reviewedAt: error.fidelity.checkedAt } };
  }
}
