import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveMaxTokens,
  assertImageDimensions,
  assertImageBytes,
  HARD_MAX_OUTPUT_TOKENS,
  MAX_IMAGE_DIMENSION,
} from '@/server/ai/call-limits';
import {
  assertCanSpend,
  recordOutcome,
  resetSpendGuard,
  DEFAULT_LIMITS,
} from '@/server/ai/guard/spend-guard';

describe('call-limits (techo por llamada)', () => {
  it('acota max_tokens al límite duro', () => {
    expect(resolveMaxTokens(999_999)).toBe(HARD_MAX_OUTPUT_TOKENS);
    expect(resolveMaxTokens()).toBeGreaterThan(0);
    expect(resolveMaxTokens(100)).toBe(100);
  });

  it('rechaza dimensiones de imagen sobre el máximo', () => {
    expect(() => assertImageDimensions(MAX_IMAGE_DIMENSION + 1, 10)).toThrow();
    expect(() => assertImageDimensions(10, 10)).not.toThrow();
  });

  it('rechaza imágenes de entrada demasiado grandes', () => {
    expect(() => assertImageBytes(100 * 1024 * 1024)).toThrow();
    expect(() => assertImageBytes(1024)).not.toThrow();
  });
});

describe('spend-guard (protección del saldo del proveedor)', () => {
  beforeEach(resetSpendGuard);

  it('lanza spend_cap al superar el cap diario sin tocar al proveedor', () => {
    const org = 'org-cap';
    // Justo bajo el cap: pasa. La siguiente lo supera.
    assertCanSpend(org, DEFAULT_LIMITS.dailyCapUsd - 0.01);
    expect(() => assertCanSpend(org, 1)).toThrowError(/Cap diario/);
  });

  it('lanza rate_limit al superar la frecuencia', () => {
    const org = 'org-rate';
    for (let i = 0; i < DEFAULT_LIMITS.maxRequestsPerWindow; i++) {
      assertCanSpend(org, 0); // coste 0 para aislar el límite de frecuencia
    }
    expect(() => assertCanSpend(org, 0)).toThrowError(/frecuencia/);
  });

  it('el cortacircuitos se abre tras fallos consecutivos', () => {
    const org = 'org-breaker';
    for (let i = 0; i < DEFAULT_LIMITS.breakerThreshold; i++) {
      assertCanSpend(org, 0);
      recordOutcome(org, false);
    }
    expect(() => assertCanSpend(org, 0)).toThrowError(/Cortacircuitos/);
  });

  it('un éxito reinicia el contador de fallos del cortacircuitos', () => {
    const org = 'org-recover';
    assertCanSpend(org, 0);
    recordOutcome(org, false);
    recordOutcome(org, true); // reinicia
    for (let i = 0; i < DEFAULT_LIMITS.breakerThreshold - 1; i++) {
      assertCanSpend(org, 0);
      recordOutcome(org, false);
    }
    expect(() => assertCanSpend(org, 0)).not.toThrow();
  });
});
