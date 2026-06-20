import { describe, it, expect, beforeEach } from 'vitest';
import {
  hold,
  settle,
  revert,
  reapExpiredHolds,
  InvalidHoldTransitionError,
} from '@/server/billing/credit-hold';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, uniqueSuffix } from '../helpers/db';

function holdReq(orgId: string, key: string, amount = 10, ttlMinutes = 30) {
  return {
    idempotencyKey: key,
    organizationId: orgId,
    amount,
    refType: 'deliverable',
    refId: 'd1',
    ttlMinutes,
  };
}

describe('CreditHold — máquina de estados', () => {
  beforeEach(resetDb);

  it('hold descuenta del saldo y deja el hold en PENDING', async () => {
    const org = await makeOrg(100);
    const h = await hold(holdReq(org, `k-${uniqueSuffix()}`, 30));
    expect(h.state).toBe('PENDING');
    expect(await getBalance(org)).toBe(70);
  });

  it('reaplicar la misma idempotencyKey no vuelve a descontar', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, key, 30));
    const again = await hold(holdReq(org, key, 30));
    expect(again.state).toBe('PENDING');
    expect(await getBalance(org)).toBe(70); // un solo descuento
  });

  it('settle cierra el hold sin mover el saldo (ya descontado en hold)', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, key, 30));
    const s = await settle(key);
    expect(s.state).toBe('SETTLED');
    expect(await getBalance(org)).toBe(70);
  });

  it('revert libera la reserva y repone el saldo', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, key, 30));
    const r = await revert(key);
    expect(r.state).toBe('REVERTED');
    expect(await getBalance(org)).toBe(100); // repuesto
  });

  it('settle tras revert se rechaza (estado terminal)', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, key, 30));
    await revert(key);
    await expect(settle(key)).rejects.toBeInstanceOf(InvalidHoldTransitionError);
  });

  it('doble settle es idempotente (no duplica efecto)', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, key, 30));
    await settle(key);
    const again = await settle(key);
    expect(again.state).toBe('SETTLED');
    expect(await getBalance(org)).toBe(70);
  });

  it('hold sin saldo suficiente falla y no crea el hold', async () => {
    const org = await makeOrg(5);
    const key = `k-${uniqueSuffix()}`;
    await expect(hold(holdReq(org, key, 30))).rejects.toThrow();
    expect(await getBalance(org)).toBe(5);
    expect(await prisma.creditHold.findUnique({ where: { idempotencyKey: key } })).toBeNull();
  });
});

describe('CreditHold — reaper de huérfanos', () => {
  beforeEach(resetDb);

  it('revierte holds PENDING vencidos y repone el saldo', async () => {
    const org = await makeOrg(100);
    const key = `k-${uniqueSuffix()}`;
    // TTL negativo → nace ya vencido.
    await hold(holdReq(org, key, 30, -1));
    expect(await getBalance(org)).toBe(70);

    const reaped = await reapExpiredHolds();
    expect(reaped).toBeGreaterThanOrEqual(1);

    const row = await prisma.creditHold.findUnique({ where: { idempotencyKey: key } });
    expect(row?.state).toBe('EXPIRED');
    expect(await getBalance(org)).toBe(100); // repuesto
  });

  it('no toca holds vigentes ni terminales', async () => {
    const org = await makeOrg(100);
    const vigente = `k-${uniqueSuffix()}`;
    const terminal = `k-${uniqueSuffix()}`;
    await hold(holdReq(org, vigente, 10, 60)); // vigente
    await hold(holdReq(org, terminal, 10, 60));
    await settle(terminal); // terminal

    await reapExpiredHolds();

    expect(
      (await prisma.creditHold.findUnique({ where: { idempotencyKey: vigente } }))?.state,
    ).toBe('PENDING');
    expect(
      (await prisma.creditHold.findUnique({ where: { idempotencyKey: terminal } }))?.state,
    ).toBe('SETTLED');
  });
});
