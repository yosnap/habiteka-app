/**
 * Mapa de planes a funcionalidades. Define qué puede hacer cada plan, de modo que
 * el gating consulte un único lugar en vez de dispersar condiciones por el código.
 */
import type { SubscriptionStatus } from '@/generated/prisma/enums';

export type Feature = 'generate' | 'iterate' | 'export_hd' | 'voting' | 'marketplace';

// Funcionalidades incluidas en cada plan. El plan gratuito puede generar e iterar
// (consumiendo saldo); las premium añaden extras.
const PLAN_FEATURES: Record<string, Feature[]> = {
  free: ['generate', 'iterate', 'voting'],
  pro: ['generate', 'iterate', 'export_hd', 'voting', 'marketplace'],
  business: ['generate', 'iterate', 'export_hd', 'voting', 'marketplace'],
};

/** Estados de suscripción que cuentan como activos para habilitar features. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

export function isActiveStatus(status: SubscriptionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Funcionalidades del plan; cae a las del plan gratuito si es desconocido. */
export function featuresOf(plan: string): Feature[] {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free!;
}
