/**
 * Claims del token de licencia. Codifican el plan y el ámbito de uso que la
 * facturación determina, más los datos de validez. El `kid` identifica la clave de
 * firma para soportar rotación sin caída.
 */

/** Ámbito de uso autorizado por la licencia. */
export type LicenseScope = 'internal' | 'commercial';

export interface LicenseClaims {
  /** Organización a la que pertenece la licencia. */
  organizationId: string;
  /** Plan vigente (deriva de la suscripción). */
  plan: string;
  scope: LicenseScope;
  /** Identificador de la clave de firma usada (para rotación). */
  kid: string;
  /** Expiración (epoch en segundos). */
  exp: number;
}
