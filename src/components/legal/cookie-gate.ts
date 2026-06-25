/**
 * Lógica de gating de cookies en cliente (ePrivacy): decide si una categoría no
 * esencial puede instalarse, a partir de la elección consentida.
 *
 * Es la barrera que el tracking de afiliación (F10) y analítica (F18) consultan
 * en el navegador ANTES de instalar cookies o disparar eventos. Por defecto
 * (sin elección registrada) todo lo no esencial está bloqueado: opt-in, no opt-out.
 *
 * Lógica pura y sin estado de React para poder testearla sin montar componentes.
 */
export type CookieCategory = 'necessary' | 'analytics' | 'affiliate';

export interface CookieChoice {
  analytics: boolean;
  affiliate: boolean;
}

/** Elección por defecto: nada no esencial consentido. */
export const DENY_ALL: CookieChoice = { analytics: false, affiliate: false };

/**
 * true si la categoría puede instalarse. Las "necesarias" siempre; el resto solo
 * si la elección las consintió. Sin elección (`null`) → solo necesarias.
 */
export function canUseCookieCategory(
  category: CookieCategory,
  choice: CookieChoice | null,
): boolean {
  if (category === 'necessary') return true;
  if (!choice) return false;
  return choice[category] === true;
}
