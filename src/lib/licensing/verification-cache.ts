/**
 * Caché del último resultado de verificación válido, con periodo de gracia.
 *
 * Evita el lock-out del propio servicio: si la verificación falla de forma
 * TRANSITORIA (un glitch del servicio de claves, no un token inválido), se sigue
 * sirviendo el último resultado válido durante el periodo de gracia, en lugar de
 * cortar la IA por un fallo pasajero. Solo cuando el glitch persiste más allá del
 * grace se aplica fail-closed.
 */
import type { LicenseClaims } from './license-claims';

interface CachedEntry {
  claims: LicenseClaims;
  verifiedAt: number;
}

const cache = new Map<string, CachedEntry>();

const GRACE_MS = 5 * 60 * 1000;

/** Guarda un resultado de verificación válido para una organización. */
export function cacheValid(
  organizationId: string,
  claims: LicenseClaims,
  now: number = Date.now(),
): void {
  cache.set(organizationId, { claims, verifiedAt: now });
}

/**
 * Devuelve los claims cacheados si siguen dentro del periodo de gracia; null si no
 * hay caché o ya venció. Se usa solo ante un fallo transitorio de verificación.
 */
export function cachedWithinGrace(
  organizationId: string,
  now: number = Date.now(),
  graceMs: number = GRACE_MS,
): LicenseClaims | null {
  const entry = cache.get(organizationId);
  if (!entry) return null;
  if (now - entry.verifiedAt > graceMs) return null;
  return entry.claims;
}

export function resetVerificationCache(): void {
  cache.clear();
}
