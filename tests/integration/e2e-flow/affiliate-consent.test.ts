import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, makeUser } from '../../helpers/db';
import { trackAffiliateClick } from '@/addons/marketplace/server/affiliate-tracking';
import { recordCookieConsent } from '@/server/legal/cookie-consent-service';

beforeEach(async () => {
  await resetDb();
});

async function countAffiliateEvents(userId: string): Promise<number> {
  return prisma.usageEvent.count({ where: { userId, action: 'affiliate_click' } });
}

describe('trackAffiliateClick respeta el consentimiento de cookies (ePrivacy)', () => {
  it('usuario sin consentimiento de afiliación: NO se registra el clic', async () => {
    const org = await makeOrg();
    const user = await makeUser();
    await trackAffiliateClick({ itemId: 'i1', userId: user.id, organizationId: org });
    expect(await countAffiliateEvents(user.id)).toBe(0);
  });

  it('usuario que consintió afiliación: el clic se registra', async () => {
    const org = await makeOrg();
    const user = await makeUser();
    await recordCookieConsent(user.id, { analytics: false, affiliate: true });
    await trackAffiliateClick({ itemId: 'i1', userId: user.id, organizationId: org });
    expect(await countAffiliateEvents(user.id)).toBe(1);
  });

  it('clic anónimo (sin userId): se anota como métrica sin PII', async () => {
    const org = await makeOrg();
    await trackAffiliateClick({ itemId: 'i1', organizationId: org });
    expect(await prisma.usageEvent.count({ where: { action: 'affiliate_click' } })).toBe(1);
  });
});
