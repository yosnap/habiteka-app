import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { prisma } from '@/server/db/prisma';

// El cliente de Polar se mockea: el reembolso no llama a la API real.
const refundCreate = vi.fn();
vi.mock('@/server/billing/polar/polar-client', () => ({
  getPolarClient: () => ({ refunds: { create: refundCreate } }),
}));

import { refundOrder } from '@/server/billing/polar/refund-service';
import { writeAudit } from '@/server/admin/audit';

describe('refund-service + auditoría', () => {
  beforeEach(async () => {
    await resetDb();
    refundCreate.mockReset();
    refundCreate.mockResolvedValue({ id: 'ref_1' });
  });

  it('delega el reembolso en la API de pagos con el importe y motivo', async () => {
    await refundOrder({ orderId: 'ord_1', amount: 1999, reason: 'customer_request' });
    expect(refundCreate).toHaveBeenCalledOnce();
    expect(refundCreate.mock.calls[0]?.[0]).toMatchObject({
      orderId: 'ord_1',
      amount: 1999,
      reason: 'customer_request',
    });
  });

  it('usa un motivo por defecto si no se indica', async () => {
    await refundOrder({ orderId: 'ord_2', amount: 500 });
    expect(refundCreate.mock.calls[0]?.[0]).toMatchObject({ reason: 'customer_request' });
  });

  it('la auditoría de reembolso queda registrada (append-only)', async () => {
    await writeAudit({
      actorId: 'admin-1',
      action: 'refund_order',
      targetType: 'order',
      targetId: 'ord_3',
      meta: { amount: 999 },
    });
    const log = await prisma.auditLog.findFirst({ where: { action: 'refund_order' } });
    expect(log?.targetId).toBe('ord_3');
  });
});
