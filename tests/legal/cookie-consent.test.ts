import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, makeUser } from '../helpers/db';
import {
  recordCookieConsent,
  getCookieConsent,
  cookieCategoryAllowed,
} from '@/server/legal/cookie-consent-service';

beforeEach(async () => {
  await resetDb();
});

describe('cookie-consent-service (fuente de verdad ePrivacy)', () => {
  it('sin registro, todo lo no esencial está denegado (fail-closed)', async () => {
    const user = await makeUser();
    expect(await cookieCategoryAllowed(user.id, 'analytics')).toBe(false);
    expect(await cookieCategoryAllowed(user.id, 'affiliate')).toBe(false);
  });

  it('respeta la elección granular registrada', async () => {
    const user = await makeUser();
    await recordCookieConsent(user.id, { analytics: true, affiliate: false });
    expect(await cookieCategoryAllowed(user.id, 'analytics')).toBe(true);
    expect(await cookieCategoryAllowed(user.id, 'affiliate')).toBe(false);
  });

  it('la elección más reciente prevalece', async () => {
    const user = await makeUser();
    await recordCookieConsent(user.id, { analytics: true, affiliate: true });
    await recordCookieConsent(user.id, { analytics: false, affiliate: false });
    const consent = await getCookieConsent(user.id);
    expect(consent).toEqual({ analytics: false, affiliate: false });
  });
});
