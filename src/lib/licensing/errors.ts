/**
 * Errores tipados de la licencia. Distinguen por qué un token no autoriza, para
 * que el servicio reaccione (renovar, degradar, cortar) y muestre un mensaje
 * accionable.
 */
export type LicenseErrorKind =
  | 'missing'
  | 'expired'
  | 'invalid_signature'
  | 'out_of_scope'
  | 'unavailable'; // servicio de claves/firma caído tras agotar el grace

export class LicenseError extends Error {
  constructor(
    public readonly kind: LicenseErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

export function licenseError(kind: LicenseErrorKind, message: string): LicenseError {
  return new LicenseError(kind, message);
}
