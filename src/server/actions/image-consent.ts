'use server';

/**
 * Consentimiento para el tratamiento de imágenes con IA (RGPD), de cara a la UI.
 *
 * El flujo de subida lo exige antes de procesar una foto: estas acciones resuelven
 * el usuario de la sesión (no aceptan un userId del cliente) y delegan en el
 * servicio de privacidad. La versión de política se fija aquí en un único sitio.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { recordConsent, hasConsent } from '@/server/privacy/consent-service';

const IMAGE_POLICY_VERSION = '2026-06';

/** Indica si el usuario en sesión ya consintió el tratamiento de imágenes. */
export async function checkImageConsent(): Promise<boolean> {
  const ctx = await requireOrgContext();
  return hasConsent(ctx.userId, 'IMAGE_PROCESSING');
}

/** Registra el consentimiento del usuario en sesión para tratar sus imágenes. */
export async function grantImageConsent(): Promise<void> {
  const ctx = await requireOrgContext();
  await recordConsent({
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    purpose: 'IMAGE_PROCESSING',
    policyVersion: IMAGE_POLICY_VERSION,
    granted: true,
  });
}
