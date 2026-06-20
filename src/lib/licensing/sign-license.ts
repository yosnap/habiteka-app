/**
 * Emisión del token de licencia firmado.
 *
 * Firma un JWT asimétrico (EdDSA) con la clave privada activa, incluyendo el `kid`
 * en la cabecera para que la verificación elija la clave correcta. La expiración es
 * corta: el token se renueva con frecuencia, de modo que un token filtrado tiene
 * poca vida útil.
 */
import { SignJWT } from 'jose';
import { activeSigningKey } from './keys';
import type { LicenseScope } from './license-claims';

export interface IssueLicenseInput {
  organizationId: string;
  plan: string;
  scope: LicenseScope;
  /** Validez en segundos (corta por diseño). */
  ttlSeconds?: number;
}

const DEFAULT_TTL = 15 * 60;

/** Emite un token de licencia firmado para una organización. */
export async function issueLicense(input: IssueLicenseInput): Promise<string> {
  const key = activeSigningKey();
  const ttl = input.ttlSeconds ?? DEFAULT_TTL;

  return new SignJWT({ plan: input.plan, scope: input.scope })
    .setProtectedHeader({ alg: 'EdDSA', kid: key.kid })
    .setSubject(input.organizationId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(key.privateKey);
}
