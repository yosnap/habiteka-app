import { UserFacingError } from './user-facing-error';
import type { RenderFidelityReport } from '@/lib/editor-document/render-fidelity';

/** Rechazo de una imagen ya evaluada; permite continuar las demás vistas del lote. */
export class RenderRejectedError extends UserFacingError {
  readonly code = 'render_rejected';
  constructor(message: string, readonly fidelity?: RenderFidelityReport) { super(message); }
}
