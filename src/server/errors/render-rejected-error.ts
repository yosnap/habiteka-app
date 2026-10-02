import { UserFacingError } from './user-facing-error';

/** Rechazo de una imagen ya evaluada; permite continuar las demás vistas del lote. */
export class RenderRejectedError extends UserFacingError {
  readonly code = 'render_rejected';
}
