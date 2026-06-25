/**
 * Guardia de licencia previa al consumo de IA (punto único, invocado por el
 * adaptador). Verifica el token y, ante un fallo TRANSITORIO de la verificación
 * (no del token en sí), recurre al resultado cacheado dentro del periodo de gracia
 * para no cortar el servicio propio por un glitch. Un token inválido, expirado o
 * fuera de ámbito SÍ se rechaza de inmediato (eso no es transitorio).
 *
 * Es el ÚNICO sitio donde se decide si una llamada a IA está licenciada, para que
 * ninguna ruta lo eluda.
 */
import { verifyLicense, type VerifyOptions } from './verify-license';
import { cacheValid, cachedWithinGrace } from './verification-cache';
import { LicenseError, licenseError } from './errors';
import type { LicenseClaims } from './license-claims';

export interface GuardInput {
  organizationId: string;
  token: string | undefined;
  options?: VerifyOptions;
  now?: number;
}

/** Autoriza (o no) una llamada a IA. Devuelve los claims o lanza `LicenseError`. */
export async function ensureLicensed(input: GuardInput): Promise<LicenseClaims> {
  if (!input.token) {
    throw licenseError('missing', 'Falta el token de licencia');
  }

  try {
    const claims = await verifyLicense(input.token, input.options);
    cacheValid(input.organizationId, claims, input.now);
    return claims;
  } catch (err) {
    // Un fallo del propio token NO es transitorio: se rechaza sin grace.
    if (err instanceof LicenseError) {
      throw err;
    }
    // Fallo transitorio (servicio de claves, etc.): se intenta el grace.
    const cached = cachedWithinGrace(input.organizationId, input.now);
    if (cached) {
      return cached;
    }
    throw licenseError('unavailable', 'No se pudo verificar la licencia');
  }
}
