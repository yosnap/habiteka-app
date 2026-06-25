/**
 * Errores tipados de facturación. Distinguen las causas de negocio para que la
 * UI y los consumidores (agente, feedback) reaccionen de forma específica.
 */

export type BillingErrorKind =
  | 'insufficient_credits'
  | 'invalid_signature'
  | 'unknown_event'
  | 'email_unverified'
  | 'origin_limit'
  | 'global_cap'
  | 'invalid_transition';

export class BillingError extends Error {
  constructor(
    public readonly kind: BillingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export function billingError(kind: BillingErrorKind, message: string): BillingError {
  return new BillingError(kind, message);
}
