/**
 * Verificación del token de licencia.
 *
 * Comprueba la firma (con la clave pública del `kid` indicado en la cabecera), la
 * expiración y, si se exige, el ámbito. Cada fallo se traduce a un `LicenseError`
 * tipado para que quien llama sepa la causa exacta. La verificación es local
 * (criptografía asimétrica), sin red por petición.
 */
import { jwtVerify, decodeProtectedHeader, errors as joseErrors } from 'jose';
import { publicKeyFor } from './keys';
import { licenseError } from './errors';
import type { LicenseClaims, LicenseScope } from './license-claims';

export interface VerifyOptions {
  /** Si se indica, exige que el token tenga este ámbito o mayor. */
  requiredScope?: LicenseScope;
}

/** Verifica el token y devuelve sus claims, o lanza `LicenseError`. */
export async function verifyLicense(
  token: string,
  options: VerifyOptions = {},
): Promise<LicenseClaims> {
  let kid: string | undefined;
  try {
    kid = decodeProtectedHeader(token).kid;
  } catch {
    throw licenseError('invalid_signature', 'Cabecera del token ilegible');
  }
  if (!kid) {
    throw licenseError('invalid_signature', 'Token sin identificador de clave');
  }

  const key = publicKeyFor(kid);
  if (!key) {
    throw licenseError('invalid_signature', `Clave de firma desconocida: ${kid}`);
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, { algorithms: ['EdDSA'] }));
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw licenseError('expired', 'Token de licencia expirado');
    }
    throw licenseError('invalid_signature', 'Firma de licencia inválida');
  }

  const claims: LicenseClaims = {
    organizationId: String(payload.sub),
    plan: String(payload.plan),
    scope: payload.scope === 'commercial' ? 'commercial' : 'internal',
    kid,
    exp: Number(payload.exp),
  };

  if (options.requiredScope === 'commercial' && claims.scope !== 'commercial') {
    throw licenseError('out_of_scope', 'La licencia no cubre uso comercial');
  }

  return claims;
}
