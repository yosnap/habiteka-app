import { describe, it, expect } from 'vitest';
import {
  isValidScale,
  pxToMeters,
  metersToPx,
  formatLength,
  formatObjectSize,
  deriveScaleFromKnownLength,
} from '@/canvas/scale';
import type { CanvasScale } from '@/canvas/types';

const scale50: CanvasScale = { pxPerMeter: 50, ratio: 50 };

describe('escala: validación', () => {
  it('acepta pxPerMeter positivo y finito', () => {
    expect(isValidScale(scale50)).toBe(true);
    expect(isValidScale({ pxPerMeter: 1 })).toBe(true);
  });

  it('rechaza pxPerMeter no positivo o no finito', () => {
    expect(isValidScale({ pxPerMeter: 0 })).toBe(false);
    expect(isValidScale({ pxPerMeter: -10 })).toBe(false);
    expect(isValidScale({ pxPerMeter: NaN })).toBe(false);
    expect(isValidScale({ pxPerMeter: Infinity })).toBe(false);
  });

  it('rechaza valores que no son objeto con pxPerMeter', () => {
    expect(isValidScale(null)).toBe(false);
    expect(isValidScale(undefined)).toBe(false);
    expect(isValidScale(42)).toBe(false);
    expect(isValidScale({})).toBe(false);
  });
});

describe('escala: conversión px ↔ metros', () => {
  it('pxToMeters divide por pxPerMeter', () => {
    expect(pxToMeters(100, scale50)).toBe(2);
    expect(pxToMeters(45, scale50)).toBe(0.9);
  });

  it('metersToPx multiplica por pxPerMeter', () => {
    expect(metersToPx(2, scale50)).toBe(100);
    expect(metersToPx(0.9, scale50)).toBe(45);
  });

  it('ida y vuelta px → m → px conserva el valor', () => {
    const px = 137;
    expect(metersToPx(pxToMeters(px, scale50), scale50)).toBeCloseTo(px, 6);
  });
});

describe('escala: formateo de longitud', () => {
  it('bajo 1 m usa centímetros enteros', () => {
    expect(formatLength(0.9)).toBe('90 cm');
    expect(formatLength(0.057)).toBe('6 cm');
  });

  it('a partir de 1 m usa metros con coma decimal', () => {
    expect(formatLength(2.5)).toBe('2,5 m');
    expect(formatLength(1)).toBe('1 m');
    expect(formatLength(3.04)).toBe('3 m');
  });

  it('la frontera cercana a 1 m cruza a metros, no "100 cm"', () => {
    expect(formatLength(0.999)).toBe('1 m');
    expect(formatLength(0.994)).toBe('99 cm');
  });

  it('valores inválidos o negativos devuelven un guion', () => {
    expect(formatLength(NaN)).toBe('—');
    expect(formatLength(-1)).toBe('—');
  });
});

describe('escala: medida de objeto respetando rotación', () => {
  it('sin rotar usa ancho × alto', () => {
    expect(formatObjectSize({ width: 200, height: 40, rotation: 0 }, scale50)).toBe('4 m × 80 cm');
  });

  it('rotado 90° intercambia ancho y alto', () => {
    expect(formatObjectSize({ width: 200, height: 40, rotation: 90 }, scale50)).toBe('80 cm × 4 m');
  });

  it('rotado 180° vuelve a ancho × alto', () => {
    expect(formatObjectSize({ width: 200, height: 40, rotation: 180 }, scale50)).toBe('4 m × 80 cm');
  });
});

describe('escala: calibración por longitud conocida', () => {
  it('deriva pxPerMeter de px y metros conocidos', () => {
    const s = deriveScaleFromKnownLength(150, 3);
    expect(s).toEqual({ pxPerMeter: 50 });
  });

  it('conserva el ratio presentacional si se pasa válido', () => {
    expect(deriveScaleFromKnownLength(150, 3, 50)).toEqual({ pxPerMeter: 50, ratio: 50 });
  });

  it('ignora un ratio inválido', () => {
    expect(deriveScaleFromKnownLength(150, 3, 0)).toEqual({ pxPerMeter: 50 });
    expect(deriveScaleFromKnownLength(150, 3, NaN)).toEqual({ pxPerMeter: 50 });
  });

  it('devuelve null si px o metros no permiten una escala válida', () => {
    expect(deriveScaleFromKnownLength(0, 3)).toBeNull();
    expect(deriveScaleFromKnownLength(150, 0)).toBeNull();
    expect(deriveScaleFromKnownLength(-1, 3)).toBeNull();
    expect(deriveScaleFromKnownLength(NaN, 3)).toBeNull();
  });
});
