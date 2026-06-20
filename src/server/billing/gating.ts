/**
 * Gating de funcionalidades: decide si una organización puede usar una feature
 * combinando su plan (activo) y su saldo. Es la autoridad server-side; la UI solo
 * refleja su resultado, nunca decide el acceso.
 */
import { getSubscription } from './subscription-repo';
import { featuresOf, type Feature } from './plan-features';
import { getBalance } from './credit-balance-repo';

export interface AccessDecision {
  allowed: boolean;
  reason?: 'plan_required' | 'no_balance';
}

/** Funcionalidades que, además del plan, requieren saldo para ejecutarse. */
const REQUIRE_BALANCE: Feature[] = ['generate', 'iterate'];

export async function canUse(organizationId: string, feature: Feature): Promise<AccessDecision> {
  const sub = await getSubscription(organizationId);
  // El plan gratuito tiene su propio conjunto de features aunque no esté "activo".
  const plan = sub.active ? sub.plan : 'free';
  const features = featuresOf(plan);

  if (!features.includes(feature)) {
    return { allowed: false, reason: 'plan_required' };
  }

  // Generar/iterar requieren saldo además del plan (el cobro real lo hace el débito).
  if (REQUIRE_BALANCE.includes(feature)) {
    const balance = await getBalance(organizationId);
    if (balance <= 0) {
      return { allowed: false, reason: 'no_balance' };
    }
  }

  return { allowed: true };
}

/** Verdadero si la organización tiene un plan de pago activo (premium). */
export async function isPremium(organizationId: string): Promise<boolean> {
  const sub = await getSubscription(organizationId);
  return sub.active && sub.plan !== 'free';
}
