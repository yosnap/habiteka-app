import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, makeOrg, makeUser } from '../helpers/db';
import { prisma } from '@/server/db/prisma';
import {
  recordConsent,
  hasConsent,
  assertConsent,
  ConsentRequiredError,
} from '@/server/privacy/consent-service';

async function orgAndUser() {
  const organizationId = await makeOrg();
  const user = await makeUser();
  await prisma.member.create({
    data: { id: `m-${user.id}`, organizationId, userId: user.id, role: 'owner' },
  });
  return { organizationId, userId: user.id };
}

beforeEach(async () => {
  await resetDb();
});

describe('consent-service', () => {
  it('sin registro, no hay consentimiento y assertConsent bloquea', async () => {
    const { userId } = await orgAndUser();
    expect(await hasConsent(userId, 'IMAGE_PROCESSING')).toBe(false);
    await expect(assertConsent(userId, 'IMAGE_PROCESSING')).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
  });

  it('tras otorgar, hay consentimiento y assertConsent pasa', async () => {
    const { organizationId, userId } = await orgAndUser();
    await recordConsent({
      userId,
      organizationId,
      purpose: 'IMAGE_PROCESSING',
      policyVersion: '2026-06',
      granted: true,
    });
    expect(await hasConsent(userId, 'IMAGE_PROCESSING')).toBe(true);
    await expect(assertConsent(userId, 'IMAGE_PROCESSING')).resolves.toBeUndefined();
  });

  it('la revocación posterior prevalece (el registro más reciente manda)', async () => {
    const { organizationId, userId } = await orgAndUser();
    await recordConsent({
      userId,
      organizationId,
      purpose: 'IMAGE_PROCESSING',
      policyVersion: '2026-06',
      granted: true,
    });
    await recordConsent({
      userId,
      organizationId,
      purpose: 'IMAGE_PROCESSING',
      policyVersion: '2026-06',
      granted: false,
    });
    expect(await hasConsent(userId, 'IMAGE_PROCESSING')).toBe(false);
  });
});
