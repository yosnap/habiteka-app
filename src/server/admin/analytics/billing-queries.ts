/**
 * Lectura del estado de facturación para el panel admin (solo lectura). Refleja
 * las suscripciones sincronizadas por los webhooks de pago; no ejecuta cobros ni
 * reembolsos (eso se delega a la capa de facturación).
 */
import type { SubscriptionStatus } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

export interface SubscriptionRow {
  organizationId: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

/** Lista las suscripciones, con filtro opcional por estado. */
export async function listSubscriptions(status?: SubscriptionStatus): Promise<SubscriptionRow[]> {
  return prisma.subscription.findMany({
    where: status ? { status } : {},
    select: { organizationId: true, plan: true, status: true, currentPeriodEnd: true },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Conteo de suscripciones activas (plan de pago vigente). */
export async function activeSubscriptionCount(): Promise<number> {
  return prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } });
}
