import { describe, it, expect, beforeEach } from 'vitest';
import { processBillingEvent, type BillingEvent } from '@/server/billing/polar/webhook-handlers';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { getSubscription } from '@/server/billing/subscription-repo';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';

function orderPaid(orgId: string, eventId: string, credits = 500): BillingEvent {
  return { kind: 'order_paid', eventId, organizationId: orgId, credits };
}

describe('processBillingEvent — idempotencia y acreditación', () => {
  beforeEach(resetDb);

  it('acredita créditos al pagar un pedido', async () => {
    const org = await makeOrg(0);
    const result = await processBillingEvent(orderPaid(org, 'evt-1', 500));
    expect(result.processed).toBe(true);
    expect(await getBalance(org)).toBe(500);
  });

  it('un reenvío del MISMO evento no vuelve a acreditar (idempotente)', async () => {
    const org = await makeOrg(0);
    await processBillingEvent(orderPaid(org, 'evt-2', 500));
    const replay = await processBillingEvent(orderPaid(org, 'evt-2', 500));

    expect(replay.duplicate).toBe(true);
    expect(replay.processed).toBe(false);
    expect(await getBalance(org)).toBe(500); // un solo acreditado
  });

  it('eventos distintos acreditan de forma acumulativa', async () => {
    const org = await makeOrg(0);
    await processBillingEvent(orderPaid(org, 'evt-3', 500));
    await processBillingEvent(orderPaid(org, 'evt-4', 300));
    expect(await getBalance(org)).toBe(800);
  });

  it('un evento de suscripción sincroniza el plan de la organización', async () => {
    const org = await makeOrg(0);
    await processBillingEvent({
      kind: 'subscription_changed',
      eventId: 'evt-5',
      organizationId: org,
      plan: 'pro',
      status: 'ACTIVE',
    });
    const sub = await getSubscription(org);
    expect(sub.plan).toBe('pro');
    expect(sub.active).toBe(true);
  });

  it('registra el evento procesado para la deduplicación', async () => {
    const org = await makeOrg(0);
    await processBillingEvent(orderPaid(org, 'evt-6', 100));
    const row = await prisma.processedWebhookEvent.findUnique({ where: { eventId: 'evt-6' } });
    expect(row).not.toBeNull();
  });
});
