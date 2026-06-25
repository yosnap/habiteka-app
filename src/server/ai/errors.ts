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
  | 'timeout';

export class AiError extends Error {
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
