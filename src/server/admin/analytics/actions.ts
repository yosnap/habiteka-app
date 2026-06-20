'use server';

/**
 * Server Actions de analítica y facturación del back-office. Las consultas son de
 * solo lectura; el reembolso delega en la capa de facturación (Polar) y queda
 * auditado. Todo revalida el rol admin.
 */
import { requireAdmin } from '../guard';
import { writeAudit } from '../audit';
import { usageByAction, activeUsers, creditsConsumedByOrg, type DateRange } from './usage-queries';
import { listAuditLog, userCreations, type AuditQuery } from './audit-queries';
import { listSubscriptions, activeSubscriptionCount } from './billing-queries';
import { refundOrder, type RefundInput } from '@/server/billing/polar/refund-service';

export async function adminUsageByAction(range: DateRange) {
  await requireAdmin();
  return usageByAction(range);
}

export async function adminActiveUsers(range: DateRange) {
  await requireAdmin();
  return activeUsers(range);
}

export async function adminCreditsConsumed(range: DateRange) {
  await requireAdmin();
  return creditsConsumedByOrg(range);
}

export async function adminAuditLog(query: AuditQuery) {
  await requireAdmin();
  return listAuditLog(query);
}

export async function adminUserCreations(organizationId: string) {
  await requireAdmin();
  return userCreations(organizationId);
}

export async function adminSubscriptions() {
  await requireAdmin();
  return { rows: await listSubscriptions(), activeCount: await activeSubscriptionCount() };
}

/** Reembolsa un pedido delegando en la capa de facturación; auditado. */
export async function adminRefund(input: RefundInput) {
  const actor = await requireAdmin();
  const result = await refundOrder(input);
  await writeAudit({
    actorId: actor.userId,
    action: 'refund_order',
    targetType: 'order',
    targetId: input.orderId,
    meta: { reason: input.reason ?? null, amount: input.amount },
  });
  return result;
}
