/**
 * Registro de clics de afiliación. Es una métrica interna (no un píxel de
 * terceros) y se anota como un evento de uso sin PII innecesaria. El registro es
 * tolerante a fallo: si no se puede anotar, NO se bloquea la redirección al
 * producto —la experiencia del usuario manda sobre la métrica—.
 */
import { emitUsageEvent } from '@/server/analytics/usage-emitter';
import { cookieCategoryAllowed } from '@/server/legal/cookie-consent-service';

export interface AffiliateClick {
  itemId: string;
  userId?: string;
  organizationId?: string;
}

export async function trackAffiliateClick(click: AffiliateClick): Promise<void> {
  try {
    // ePrivacy: si hay usuario identificado y NO consintió la categoría de
    // afiliación, no se registra su clic como evento de tracking (la redirección
    // al producto sí ocurre, fuera de aquí). Un clic anónimo no tiene
    // consentimiento que consultar y se anota como métrica sin PII.
    if (click.userId && !(await cookieCategoryAllowed(click.userId, 'affiliate'))) {
      return;
    }
    await emitUsageEvent({
      action: 'affiliate_click',
      unit: 'image', // unidad neutra: el clic no consume tokens
      amount: 1,
      costUsd: 0,
      userId: click.userId,
      organizationId: click.organizationId,
      refId: click.itemId,
    });
  } catch {
    // El fallo del registro no debe impedir que el usuario llegue al producto.
  }
}
