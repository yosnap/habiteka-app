import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../../helpers/db';
import { createDebitService } from '@/server/agent/debit-service-impl';
import type { OperationCost } from '@/lib/contracts';

beforeEach(async () => {
  await resetDb();
});

async function balance(orgId: string): Promise<number> {
  const row = await prisma.creditBalance.findUnique({ where: { organizationId: orgId } });
  return row?.balance ?? 0;
}

describe('cost-to-credit con DebitService REAL (sin sandbox)', () => {
  it('un coste de proveedor (USD) se convierte a créditos y el saldo cuadra', async () => {
    const orgId = await makeOrg(1000);
    const debit = createDebitService(orgId);

    // 0.40 USD → ceil(0.40 * 100) = 40 créditos.
    const cost: OperationCost = { kind: 'provider', cost: { amountUsd: 0.4, unit: 'image' } };
    const hold = await debit.hold('op-1', cost);
    expect(hold.amount).toBe(40);

    // Tras el hold, el saldo ya está descontado (reserva real).
    expect(await balance(orgId)).toBe(960);

    // Settle confirma el cobro: el saldo no se repone. El contrato pide el coste
    // real medido como 2º argumento (ver nota de desajuste en wiring/README.md).
    await debit.settle(hold, cost);
    expect(await balance(orgId)).toBe(960);
  });

  it('un revert repone el crédito reservado (coste→crédito reversible)', async () => {
    const orgId = await makeOrg(1000);
    const debit = createDebitService(orgId);

    const cost: OperationCost = {
      kind: 'tokens',
      usage: { promptTokens: 1500, completionTokens: 500 },
    };
    const hold = await debit.hold('op-2', cost); // ceil(2000/1000) = 2 créditos
    expect(hold.amount).toBe(2);
    expect(await balance(orgId)).toBe(998);

    await debit.revert(hold);
    expect(await balance(orgId)).toBe(1000);
  });
});
