import { describe, it, expect } from 'vitest';
import {
  isValidScale,
  pxToMeters,
  metersToPx,
  formatLength,
  formatObjectSize,
  formatObjectSize3d,
  effectiveHeightM,
  DEFAULT_CEILING_M,
  deriveScaleFromKnownLength,
  scaleFromRatio,
  catalogSizePx,
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

describe('escala: desde ratio arquitectónico (uso directo)', () => {
  it('1:100 da la referencia de 100 px/m y conserva el ratio', () => {
    expect(scaleFromRatio(100)).toEqual({ pxPerMeter: 100, ratio: 100 });
  });

  it('1:50 se ve el doble de grande; 1:1000 diez veces más pequeño', () => {
    expect(scaleFromRatio(50)).toEqual({ pxPerMeter: 200, ratio: 50 });
    expect(scaleFromRatio(1000)).toEqual({ pxPerMeter: 10, ratio: 1000 });
  });

  it('produce una escala válida (usable para convertir)', () => {
    const s = scaleFromRatio(50)!;
    expect(pxToMeters(200, s)).toBe(1); // a 1:50, 200 px = 1 m
  });

  it('devuelve null ante un ratio inválido', () => {
    expect(scaleFromRatio(0)).toBeNull();
    expect(scaleFromRatio(-50)).toBeNull();
    expect(scaleFromRatio(NaN)).toBeNull();
  });
});

describe('escala: altura vertical (3ª dimensión)', () => {
  it('usa heightM propio cuando está definido y es válido', () => {
    expect(effectiveHeightM({ kind: 'wall', heightM: 3 }, 2.5)).toBe(3);
  });

  it('los muros y aperturas toman la altura de techo si no tienen heightM', () => {
    expect(effectiveHeightM({ kind: 'wall' }, 2.8)).toBe(2.8);
    expect(effectiveHeightM({ kind: 'window' }, 2.8)).toBe(2.8);
    expect(effectiveHeightM({ kind: 'door' }, 2.8)).toBe(2.8);
  });

  it('los muebles caen a su altura típica, no a la del techo', () => {
    expect(effectiveHeightM({ kind: 'sofa' }, 2.8)).toBe(0.85);
    expect(effectiveHeightM({ kind: 'mesa' }, 2.8)).toBe(0.75);
  });

  it('sin altura de techo usa la estándar por defecto para muros', () => {
    expect(effectiveHeightM({ kind: 'wall' })).toBe(DEFAULT_CEILING_M);
  });

  it('un heightM inválido (0/negativo) se ignora y cae al valor por defecto', () => {
    expect(effectiveHeightM({ kind: 'wall', heightM: 0 }, 2.8)).toBe(2.8);
    expect(effectiveHeightM({ kind: 'sofa', heightM: -1 }, 2.8)).toBe(0.85);
  });

  it('formatObjectSize3d añade el alto (largo × fondo × alto)', () => {
    // 200×40 px a 50 px/m = 4 m × 80 cm; muro toma techo 2,8 m de alto.
    const out = formatObjectSize3d({ kind: 'wall', width: 200, height: 40, rotation: 0 }, scale50, 2.8);
    expect(out).toBe('4 m × 80 cm × 2,8 m (alto)');
  });
});

describe('escala: tamaño de objeto del catálogo en px', () => {
  const puerta = { defaultWidth: 60, defaultHeight: 12, realWidthM: 0.9, realDepthM: 0.1 };

  it('con escala usa las medidas reales (m → px)', () => {
    // a 50 px/m: 0,9 m = 45 px de largo; 0,1 m = 5 px de grosor.
    expect(catalogSizePx(puerta, scale50)).toEqual({ w: 45, h: 5 });
  });

  it('sin escala cae al tamaño en px por defecto del catálogo', () => {
    expect(catalogSizePx(puerta, null)).toEqual({ w: 60, h: 12 });
  });

  it('nunca baja de 2 px aunque la escala sea diminuta', () => {
    expect(catalogSizePx(puerta, { pxPerMeter: 1 })).toEqual({ w: 2, h: 2 });
  });
});
