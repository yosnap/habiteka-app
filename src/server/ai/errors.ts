/**
 * Errores tipados de la capa de IA.
 *
 * Normalizan los fallos heterogéneos del SDK/proveedor a un conjunto cerrado de
 * causas, para que quien llama (el agente) reaccione de forma específica:
 * reintentar, degradar, o cortar. El `kind` es la discriminante.
 */

export type AiErrorKind =
  | 'rate_limit'
  | 'spend_cap'
  | 'call_limit'
  | 'refusal'
  | 'schema'
  | 'provider_down'
  | 'gateway_down'
  | 'sanitizer'
  | 'timeout'
  // La organización no tiene clave propia del proveedor: se prueba el respaldo y, si ninguno la tiene, se bloquea.
  | 'missing_key';

import { UserFacingError } from '@/server/errors/user-facing-error';

export class AiError extends UserFacingError {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Atajo para construir un `AiError` de un `kind` concreto. */
export function aiError(kind: AiErrorKind, message: string, cause?: unknown): AiError {
  return new AiError(kind, message, cause);
}

/** No duplicar una generación que el proveedor ya aceptó y sigue pendiente. */
export function canFailover(error: unknown): boolean {
  if ((error as { code?: string } | null)?.code === 'kie_task_pending') return false;
  return (
    error instanceof AiError &&
    ['provider_down', 'gateway_down', 'timeout', 'rate_limit', 'missing_key'].includes(error.kind)
  );
}
