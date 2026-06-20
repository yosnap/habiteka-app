'use server';

/**
 * Server Actions de los instrumentos legales (F19): aceptación de ToS y
 * consentimiento de cookies. Cada una resuelve el usuario de la sesión antes de
 * registrar; ninguna acepta un userId del cliente (anti-suplantación).
 */
import { requireOrgContext, UnauthenticatedError } from '@/server/auth/require-org-context';
import { acceptTos, hasAcceptedCurrentTos } from './tos-acceptance-service';
import {
  recordCookieConsent,
  getCookieConsent,
  type CookieConsentChoice,
} from './cookie-consent-service';

/**
 * Resuelve el usuario de la sesión, o `null` si no hay sesión. Estar sin sesión es
 * un estado NORMAL (un visitante anónimo): las consultas de estado lo tratan como
 * "sin datos" en vez de propagar un error 500 al cargar la página.
 */
async function currentUserId(): Promise<string | null> {
  try {
    return (await requireOrgContext()).userId;
  } catch (err) {
    if (err instanceof UnauthenticatedError) return null;
    throw err;
  }
}

/** Registra que el usuario en sesión acepta el ToS vigente. */
export async function acceptCurrentTos(): Promise<void> {
  const ctx = await requireOrgContext();
  await acceptTos(ctx.userId);
}

/** Indica si el usuario en sesión ya aceptó el ToS vigente (false si no hay sesión). */
export async function checkTosAccepted(): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  return hasAcceptedCurrentTos(userId);
}

/** Guarda la elección de categorías de cookies del usuario en sesión. */
export async function saveCookieConsent(choice: CookieConsentChoice): Promise<void> {
  const ctx = await requireOrgContext();
  await recordCookieConsent(ctx.userId, choice);
}

/**
 * Devuelve la elección de cookies vigente del usuario en sesión. Sin sesión,
 * devuelve "nada consentido" (no es un error: el banner simplemente no aplica a un
 * visitante sin cuenta, que no tiene dónde registrar la elección).
 */
export async function loadCookieConsent(): Promise<CookieConsentChoice> {
  const userId = await currentUserId();
  if (!userId) return { analytics: false, affiliate: false };
  return getCookieConsent(userId);
}

export interface CookieBannerState {
  /** Si no hay sesión, el banner no se muestra (no hay dónde registrar). */
  hasSession: boolean;
  choice: CookieConsentChoice;
}

/** Estado para el banner: si hay sesión y la elección vigente. */
export async function loadCookieBannerState(): Promise<CookieBannerState> {
  const userId = await currentUserId();
  if (!userId) return { hasSession: false, choice: { analytics: false, affiliate: false } };
  return { hasSession: true, choice: await getCookieConsent(userId) };
}
