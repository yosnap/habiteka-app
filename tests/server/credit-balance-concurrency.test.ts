import { describe, it, expect, beforeEach } from 'vitest';
import { hold } from '@/server/billing/credit-hold';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { resetDb, makeOrg, uniqueSuffix } from '../helpers/db';

describe('Saldo autoritativo bajo concurrencia multi-réplica', () => {
  beforeEach(resetDb);

  it('dos holds concurrentes que exceden el saldo: uno falla, saldo nunca negativo', async () => {
    // Saldo justo para UNA de las dos reservas de 60.
    const org = await makeOrg(100);
    const k1 = `k-${uniqueSuffix()}`;
    const k2 = `k-${uniqueSuffix()}`;

    // Dos transacciones simultáneas compiten por la misma fila de saldo. El lock
    // FOR UPDATE las serializa en la BD; sin él, ambas leerían 100 y dejarían -20.
    const results = await Promise.allSettled([
      hold({ idempotencyKey: k1, organizationId: org, amount: 60, refType: 'd', refId: '1' }),
      hold({ idempotencyKey: k2, organizationId: org, amount: 60, refType: 'd', refId: '2' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const balance = await getBalance(org);
    expect(balance).toBe(40); // 100 - 60, jamás negativo
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('múltiples holds que caben se aplican todos y el saldo cuadra', async () => {
    const org = await makeOrg(100);
    const reqs = Array.from({ length: 5 }, (_, i) => ({
      idempotencyKey: `k-${uniqueSuffix()}-${i}`,
      organizationId: org,
      amount: 10,
      refType: 'd',
      refId: String(i),
    }));

    await Promise.all(reqs.map((r) => hold(r)));

    expect(await getBalance(org)).toBe(50); // 100 - 5*10
  });
});
