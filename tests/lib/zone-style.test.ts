import { describe, it, expect } from 'vitest';
import { resolveZoneStyle, setZoneOverride } from '@/lib/zone-style';
import type { Collected } from '@/lib/contracts';

const base: Collected = { estilo: 'nordico', objetivo: 'reformar', entregables: [] };

describe('resolveZoneStyle — estilo efectivo de una zona', () => {
  it('sin override usa el estilo/objetivo global', () => {
    const r = resolveZoneStyle(base, 'z1');
    expect(r).toEqual({ estilo: 'nordico', objetivo: 'reformar' });
  });

  it('zoneId null (plano por defecto) usa siempre lo global', () => {
    const withOverride: Collected = { ...base, zoneOverrides: { z1: { estilo: 'industrial' } } };
    expect(resolveZoneStyle(withOverride, null).estilo).toBe('nordico');
  });

  it('el override de la zona prevalece y lo no definido se hereda', () => {
    const c: Collected = { ...base, zoneOverrides: { z1: { estilo: 'industrial' } } };
    const r = resolveZoneStyle(c, 'z1');
    expect(r.estilo).toBe('industrial'); // override
    expect(r.objetivo).toBe('reformar'); // heredado del global
  });
});

describe('setZoneOverride — fija/limpia el override de una zona', () => {
  it('fija el estilo de una zona', () => {
    const next = setZoneOverride(base, 'z1', { estilo: 'industrial' });
    expect(next.zoneOverrides?.z1?.estilo).toBe('industrial');
  });

  it('limpiar el override (estilo undefined) elimina la entrada y la zona hereda lo global', () => {
    const withOverride = setZoneOverride(base, 'z1', { estilo: 'industrial' });
    const cleared = setZoneOverride(withOverride, 'z1', { estilo: undefined });
    expect(cleared.zoneOverrides?.z1).toBeUndefined();
    expect(resolveZoneStyle(cleared, 'z1').estilo).toBe('nordico');
  });

  it('sin overrides restantes, elimina la clave zoneOverrides (no deja ruido)', () => {
    const withOverride = setZoneOverride(base, 'z1', { estilo: 'industrial' });
    const cleared = setZoneOverride(withOverride, 'z1', {});
    expect('zoneOverrides' in cleared).toBe(false);
  });

  it('es inmutable: no muta el Collected original', () => {
    setZoneOverride(base, 'z1', { estilo: 'industrial' });
    expect(base.zoneOverrides).toBeUndefined();
  });
});
