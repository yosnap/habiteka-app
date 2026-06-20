/**
 * Consentimiento de cookies (ePrivacy): única fuente de verdad sobre qué
 * categorías no esenciales puede usar el tracking.
 *
 * Por defecto, NADA no esencial está consentido (opt-in, no opt-out). El tracking
 * de afiliación (F10) y de analítica (F18) DEBE consultar `cookieCategoryAllowed`
 * antes de instalar cookies o disparar eventos. Las cookies "necesarias" no pasan
 * por aquí (son imprescindibles para el servicio).
 */
import { prisma } from '@/server/db/prisma';

export type CookieCategory = 'analytics' | 'affiliate';

export const CURRENT_COOKIE_POLICY_VERSION = '2026-06';

export interface CookieConsentChoice {
  analytics: boolean;
  affiliate: boolean;
}

/** Registra la elección de categorías del usuario (append-only). */
export async function recordCookieConsent(
  userId: string,
  choice: CookieConsentChoice,
  version: string = CURRENT_COOKIE_POLICY_VERSION,
): Promise<void> {
  await prisma.cookieConsent.create({
    data: {
      userId,
      analytics: choice.analytics,
      affiliate: choice.affiliate,
      version,
    },
  });
}

/** Devuelve la elección vigente del usuario; sin registro → todo denegado. */
export async function getCookieConsent(userId: string): Promise<CookieConsentChoice> {
  const latest = await prisma.cookieConsent.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { analytics: true, affiliate: true },
  });
  return {
    analytics: latest?.analytics ?? false,
    affiliate: latest?.affiliate ?? false,
  };
}

/**
 * true si una categoría no esencial está consentida AHORA. Punto único que
 * F10/F18 consultan antes de cualquier tracking. Fail-closed: sin registro, false.
 */
export async function cookieCategoryAllowed(
  userId: string,
  category: CookieCategory,
): Promise<boolean> {
  const consent = await getCookieConsent(userId);
  return consent[category];
}
