import { describe, it, expect, beforeEach } from 'vitest';
import { provisionOrganization } from '@/server/auth/provision-organization';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeUser } from '../helpers/db';

async function setWelcomeCredits(value: number) {
  await prisma.systemSetting.upsert({
    where: { key: 'welcome_credits' },
    update: { value },
    create: { key: 'welcome_credits', value },
  });
}

describe('provisionOrganization', () => {
  beforeEach(resetDb);

  it('crea organización implícita + balance + acredita welcome una vez', async () => {
    await setWelcomeCredits(100);
    const user = await makeUser();

    const result = await provisionOrganization({
      userId: user.id,
      userName: user.name,
      email: user.email,
    });

    expect(result.created).toBe(true);
    expect(await getBalance(result.organizationId)).toBe(100);

    const member = await prisma.member.findFirst({ where: { userId: user.id } });
    expect(member?.role).toBe('owner');

    const grants = await prisma.creditLedger.count({
      where: { organizationId: result.organizationId, reason: 'welcome_grant' },
    });
    expect(grants).toBe(1);
  });

  it('es idempotente: reaplicar no crea otra org ni re-acredita', async () => {
    await setWelcomeCredits(100);
    const user = await makeUser();

    const first = await provisionOrganization({
      userId: user.id,
      userName: user.name,
      email: user.email,
    });
    const second = await provisionOrganization({
      userId: user.id,
      userName: user.name,
      email: user.email,
    });

    expect(second.created).toBe(false);
    expect(second.organizationId).toBe(first.organizationId);
    expect(await getBalance(first.organizationId)).toBe(100); // no re-acredita

    // Contar las orgs DE ESTE usuario (no del total: la BD de dev conserva el
    // admin de desarrollo). Provisionar dos veces no debe crear una segunda.
    const orgCount = await prisma.member.count({ where: { userId: user.id } });
    expect(orgCount).toBe(1);
  });

  it('registra el dominio de email como origen del alta (anti-sybil)', async () => {
    await setWelcomeCredits(0);
    const user = await makeUser('persona@dominio.test');

    const { organizationId } = await provisionOrganization({
      userId: user.id,
      userName: user.name,
      email: user.email,
      originIp: '203.0.113.7',
    });

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    expect(org?.originEmailDomain).toBe('dominio.test');
    expect(org?.originIp).toBe('203.0.113.7');
  });

  it('sin welcome_credits configurados no escribe grant pero crea la org', async () => {
    await setWelcomeCredits(0);
    const user = await makeUser();

    const { organizationId } = await provisionOrganization({
      userId: user.id,
      userName: user.name,
      email: user.email,
    });

    expect(await getBalance(organizationId)).toBe(0);
    const grants = await prisma.creditLedger.count({ where: { reason: 'welcome_grant' } });
    expect(grants).toBe(0);
  });
});
