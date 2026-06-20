import { describe, it, expect, beforeEach } from 'vitest';
import { freeIterationsRemaining, isNextIterationFree } from '@/server/billing/free-iterations';
import { assertFreeQuotaAllowed } from '@/server/billing/free-quota-gate';
import { canUse } from '@/server/billing/gating';
import { assertGlobalCap } from '@/server/billing/global-cap';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, makeUser } from '../helpers/db';

async function setSetting(key: string, value: number) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function makeDeliverable(orgId: string): Promise<string> {
  const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
  const del = await prisma.deliverable.create({
    data: { projectId: project.id, type: 'RENDER_3D', payload: {}, legalSeal: 'x', version: 1 },
  });
  return del.id;
}

async function addIterations(deliverableId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await prisma.iteration.create({
      data: { deliverableId, zone: {}, instruction: `i${i}` },
    });
  }
}

describe('free-iterations — cupo gratis por entregable', () => {
  beforeEach(resetDb);

  it('las primeras N iteraciones son gratis; la N+1 ya no', async () => {
    await setSetting('free_iterations_per_deliverable', 3);
    const org = await makeOrg(0);
    const del = await makeDeliverable(org);

    expect(await isNextIterationFree(del)).toBe(true); // 0 usadas
    await addIterations(del, 3);

    const state = await freeIterationsRemaining(del);
    expect(state.remaining).toBe(0);
    expect(await isNextIterationFree(del)).toBe(false); // agotado
  });

  it('el cupo es por entregable (otro entregable parte de cero)', async () => {
    await setSetting('free_iterations_per_deliverable', 2);
    const org = await makeOrg(0);
    const delA = await makeDeliverable(org);
    const delB = await makeDeliverable(org);
    await addIterations(delA, 2); // agota A

    expect(await isNextIterationFree(delA)).toBe(false);
    expect(await isNextIterationFree(delB)).toBe(true); // B intacto
  });

  it('lee N en caliente desde la configuración', async () => {
    const org = await makeOrg(0);
    const del = await makeDeliverable(org);
    await setSetting('free_iterations_per_deliverable', 1);
    expect((await freeIterationsRemaining(del)).total).toBe(1);
    await setSetting('free_iterations_per_deliverable', 5);
    expect((await freeIterationsRemaining(del)).total).toBe(5);
  });
});

describe('free-quota-gate — anti-sybil del cupo gratis', () => {
  beforeEach(resetDb);

  async function makeOrgWithOwner(emailVerified: boolean, originIp?: string): Promise<string> {
    const user = await makeUser();
    if (!emailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    }
    const orgId = `org-${user.id}`;
    await prisma.organization.create({
      data: {
        id: orgId,
        name: 'Org',
        accountType: 'B2C',
        originIp,
        members: { create: { id: `mem-${user.id}`, userId: user.id, role: 'owner' } },
        creditBalance: { create: { balance: 0 } },
      },
    });
    return orgId;
  }

  it('bloquea el cupo gratis si el email no está verificado', async () => {
    const org = await makeOrgWithOwner(false);
    await expect(assertFreeQuotaAllowed(org)).rejects.toMatchObject({ kind: 'email_unverified' });
  });

  it('permite el cupo gratis con email verificado y dentro del límite de origen', async () => {
    await setSetting('accounts_per_origin_limit', 3);
    const org = await makeOrgWithOwner(true, '203.0.113.1');
    await expect(assertFreeQuotaAllowed(org)).resolves.toBeUndefined();
  });
});

describe('gating y cap global', () => {
  beforeEach(resetDb);

  it('canUse niega generar sin saldo', async () => {
    const org = await makeOrg(0);
    const decision = await canUse(org, 'generate');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no_balance');
  });

  it('canUse permite generar con saldo', async () => {
    const org = await makeOrg(100);
    expect((await canUse(org, 'generate')).allowed).toBe(true);
  });

  it('el cap global no afecta a un premium', async () => {
    await setSetting('global_spend_cap_usd', 0); // ya superado
    await expect(assertGlobalCap(true)).resolves.toBeUndefined();
    await expect(assertGlobalCap(false)).rejects.toMatchObject({ kind: 'global_cap' });
  });
});
