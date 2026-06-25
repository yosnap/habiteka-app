import { describe, it, expect } from 'vitest';
import { ZONE_KINDS, EXTERIOR_ZONE_KINDS, isValidZoneKind } from '@/lib/zone-kinds';
import { isExteriorZone } from '@/server/agent/phases/entrega';

describe('zone-kinds — vocabulario controlado de tipo de zona', () => {
  it('interior no es exterior; el resto del vocabulario exterior sí', () => {
    expect(EXTERIOR_ZONE_KINDS.has('interior')).toBe(false);
    // Todos los valores marcados exterior están en el set derivado.
    for (const k of ZONE_KINDS.filter((z) => z.exterior)) {
      expect(EXTERIOR_ZONE_KINDS.has(k.value)).toBe(true);
    }
  });

  it('isValidZoneKind acepta solo valores del vocabulario', () => {
    expect(isValidZoneKind('interior')).toBe(true);
    expect(isValidZoneKind('fachada')).toBe(true);
    expect(isValidZoneKind('patio')).toBe(false);
    expect(isValidZoneKind('')).toBe(false);
  });

  it('isExteriorZone (render) coincide con el vocabulario: cada valor exterior → true', () => {
    for (const k of ZONE_KINDS) {
      expect(isExteriorZone(k.value)).toBe(k.exterior);
    }
  });
});
