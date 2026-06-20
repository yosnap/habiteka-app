'use server';

/**
 * Server Actions de los instrumentos legales (F19): aceptación de ToS y
 * consentimiento de cookies. Cada una resuelve el usuario de la sesión antes de
 * registrar; ninguna acepta un userId del cliente (anti-suplantación).
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { acceptTos, hasAcceptedCurrentTos } from './tos-acceptance-service';
import {
  recordCookieConsent,
  getCookieConsent,
  type CookieConsentChoice,
} from './cookie-consent-service';

/** Registra que el usuario en sesión acepta el ToS vigente. */
export async function acceptCurrentTos(): Promise<void> {
  const ctx = await requireOrgContext();
  await acceptTos(ctx.userId);
}

/** Indica si el usuario en sesión ya aceptó el ToS vigente. */
export async function checkTosAccepted(): Promise<boolean> {
  const ctx = await requireOrgContext();
  return hasAcceptedCurrentTos(ctx.userId);
}

/** Guarda la elección de categorías de cookies del usuario en sesión. */
export async function saveCookieConsent(choice: CookieConsentChoice): Promise<void> {
  const ctx = await requireOrgContext();
  await recordCookieConsent(ctx.userId, choice);
}

/** Devuelve la elección de cookies vigente del usuario en sesión. */
export async function loadCookieConsent(): Promise<CookieConsentChoice> {
  const ctx = await requireOrgContext();
  return getCookieConsent(ctx.userId);
}
