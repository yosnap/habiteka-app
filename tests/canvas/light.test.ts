import { describe, it, expect } from 'vitest';
import { isLight, defaultLight, clampIntensity, describeLight } from '@/canvas/light';

describe('light — helpers de iluminación', () => {
  it('isLight reconoce el foco y no un mueble', () => {
    expect(isLight('foco')).toBe(true);
    expect(isLight('sofa')).toBe(false);
    expect(isLight('lampara')).toBe(false); // lámpara es mueble, no luz de 1ª clase
  });

  it('defaultLight es una luz cálida de intensidad media válida', () => {
    const l = defaultLight();
    expect(l.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(l.intensidad).toBeGreaterThan(0);
    expect(l.intensidad).toBeLessThanOrEqual(100);
  });

  it('clampIntensity acota a 0–100 y redondea; no finito cae a 0', () => {
    expect(clampIntensity(150)).toBe(100);
    expect(clampIntensity(-10)).toBe(0);
    expect(clampIntensity(42.6)).toBe(43);
    expect(clampIntensity(NaN)).toBe(0);
    expect(clampIntensity(Infinity)).toBe(0);
  });

  it('describeLight clasifica temperatura por color e intensidad por nivel', () => {
    expect(describeLight({ color: '#ff8030', intensidad: 90 })).toBe('luz cálida intensa');
    expect(describeLight({ color: '#3050ff', intensidad: 10 })).toBe('luz fría tenue');
    expect(describeLight({ color: '#808080', intensidad: 50 })).toBe('luz neutra media');
  });

  it('describeLight tolera un color sin formato (neutra)', () => {
    expect(describeLight({ color: 'rojo', intensidad: 50 })).toContain('neutra');
  });
});
