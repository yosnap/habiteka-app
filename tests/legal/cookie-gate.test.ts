import { describe, it, expect } from 'vitest';
import { canUseCookieCategory, DENY_ALL } from '@/components/legal/cookie-gate';

describe('canUseCookieCategory (gating ePrivacy en cliente)', () => {
  it('las cookies necesarias siempre se permiten', () => {
    expect(canUseCookieCategory('necessary', null)).toBe(true);
    expect(canUseCookieCategory('necessary', DENY_ALL)).toBe(true);
  });

  it('sin elección (null), nada no esencial se permite', () => {
    expect(canUseCookieCategory('analytics', null)).toBe(false);
    expect(canUseCookieCategory('affiliate', null)).toBe(false);
  });

  it('solo la categoría consentida se habilita', () => {
    const choice = { analytics: true, affiliate: false };
    expect(canUseCookieCategory('analytics', choice)).toBe(true);
    expect(canUseCookieCategory('affiliate', choice)).toBe(false);
  });
});
