/**
 * Estado de la suscripción por organización. Lo leen el gating y la UI; lo
 * escriben los webhooks de Polar (upsert idempotente por organización). No
 * redefine el modelo (es de F2): solo lo consulta y sincroniza.
 */
import type { SubscriptionStatus } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

export interface SubscriptionState {
  plan: string;
  status: SubscriptionStatus;
  active: boolean;
}

/** Devuelve el estado de suscripción de la org (gratuito si no tiene). */
export async function getSubscription(organizationId: string): Promise<SubscriptionState> {
  const row = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!row) return { plan: 'free', status: 'INCOMPLETE', active: false };
  return {
    plan: row.plan,
    status: row.status,
    active: row.status === 'ACTIVE' || row.status === 'TRIALING',
  };
}

export interface SyncSubscriptionInput {
  organizationId: string;
  plan: string;
  status: SubscriptionStatus;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

/** Crea o actualiza la suscripción de la org (sincronización desde webhook). */
export async function syncSubscription(input: SyncSubscriptionInput): Promise<void> {
  await prisma.subscription.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      plan: input.plan,
      status: input.status,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
    },
    update: {
      plan: input.plan,
      status: input.status,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });
}
