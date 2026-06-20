import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAllowlist,
  isModelAllowed,
  assertModelAllowed,
  resetAllowlist,
  JurisdictionError,
} from '@/server/privacy/jurisdiction-allowlist';

beforeEach(() => resetAllowlist());

describe('jurisdiction allowlist', () => {
  it('permite solo los modelos cargados', () => {
    loadAllowlist('openai/gpt-eu, anthropic/claude-eu');
    expect(isModelAllowed('openai/gpt-eu')).toBe(true);
    expect(isModelAllowed('anthropic/claude-eu')).toBe(true);
    expect(isModelAllowed('random/model-us')).toBe(false);
  });

  it('lista vacía no permite ningún modelo (fail-closed)', () => {
    loadAllowlist(undefined);
    expect(isModelAllowed('cualquiera')).toBe(false);
  });

  it('assertModelAllowed lanza JurisdictionError para un modelo no permitido', () => {
    loadAllowlist('permitido');
    expect(() => assertModelAllowed('permitido')).not.toThrow();
    expect(() => assertModelAllowed('prohibido')).toThrow(JurisdictionError);
  });
});
