import { describe, expect, it } from 'vitest';
import { normalizeEvent } from '@/server/billing/polar/normalize-event';

const ctx = { eventId: 'evt_1', creditsPerPack: 100 };
const metadata = { organizationId: 'org_1' };

function orderPaid(billingReason?: string) {
  return { type: 'order.paid', data: { id: 'ord_1', metadata, billing_reason: billingReason } };
}

describe('normalizeEvent order.paid', () => {
  it('acredita el paquete en una compra suelta', () => {
    expect(normalizeEvent(orderPaid('purchase'), ctx)).toEqual({
      kind: 'order_paid',
      eventId: 'evt_1',
      organizationId: 'org_1',
      credits: 100,
    });
  });

  it.each(['subscription_create', 'subscription_cycle', 'subscription_update', 'subscription_meter_cycle'])(
    'ignora los pedidos de suscripción (%s)',
    (reason) => {
      expect(normalizeEvent(orderPaid(reason), ctx)).toBeNull();
    },
  );

  it('ignora el pedido si falta el motivo de facturación', () => {
    expect(normalizeEvent(orderPaid(), ctx)).toBeNull();
  });
});
