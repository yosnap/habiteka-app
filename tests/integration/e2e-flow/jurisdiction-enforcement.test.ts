import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAllowlist,
  resetAllowlist,
  enforceModelJurisdiction,
  isAllowlistActive,
  JurisdictionError,
} from '@/server/privacy/jurisdiction-allowlist';

beforeEach(() => resetAllowlist());

describe('enforceModelJurisdiction (wiring routing IA ↔ allowlist RGPD)', () => {
  it('sin allowlist configurada, NO bloquea (control desactivado)', () => {
    loadAllowlist('');
    expect(isAllowlistActive()).toBe(false);
    expect(() => enforceModelJurisdiction('cualquier/modelo')).not.toThrow();
  });

  it('con allowlist, permite los modelos listados y rechaza el resto', () => {
    loadAllowlist('openai/gpt-eu');
    expect(isAllowlistActive()).toBe(true);
    expect(() => enforceModelJurisdiction('openai/gpt-eu')).not.toThrow();
    expect(() => enforceModelJurisdiction('proveedor/modelo-us')).toThrow(JurisdictionError);
  });
});
