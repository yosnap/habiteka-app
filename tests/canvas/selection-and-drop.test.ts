import { describe, it, expect } from 'vitest';
import { pixelRectToZone } from '@/canvas/selection-math';
import { productDropToRef } from '@/canvas/product-drop';
import type { ProductDrop } from '@/lib/contracts';

describe('pixelRectToZone (marquesina → CanvasZone normalizada)', () => {
  it('convierte un rectángulo de píxeles a coordenadas 0–1', () => {
    const zone = pixelRectToZone(
      'z1',
      { x: 200, y: 150, width: 400, height: 300 },
      {
        width: 800,
        height: 600,
      },
    );
    expect(zone.id).toBe('z1');
    expect(zone.bbox).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('normaliza una marquesina dibujada en dirección negativa', () => {
    const zone = pixelRectToZone(
      'z2',
      { x: 600, y: 450, width: -400, height: -300 },
      {
        width: 800,
        height: 600,
      },
    );
    expect(zone.bbox?.x).toBeCloseTo(0.25);
    expect(zone.bbox?.y).toBeCloseTo(0.25);
    expect(zone.bbox?.width).toBeCloseTo(0.5);
  });

  it('acota al rango 0–1 si la selección excede el stage', () => {
    const zone = pixelRectToZone(
      'z3',
      { x: -50, y: -50, width: 2000, height: 2000 },
      {
        width: 800,
        height: 600,
      },
    );
    expect(zone.bbox?.x).toBe(0);
    expect(zone.bbox?.width).toBe(1);
  });
});

describe('productDropToRef (ProductDrop → ProductRef)', () => {
  it('materializa un drop con su posición y, si lo trae, su targetRef', () => {
    const drop: ProductDrop = {
      marketplaceItemId: 'm1',
      stageX: 120,
      stageY: 80,
      targetRef: 'pared-1',
    };
    const ref = productDropToRef(drop, 'ref-1');
    expect(ref).toEqual({
      id: 'ref-1',
      marketplaceItemId: 'm1',
      x: 120,
      y: 80,
      targetRef: 'pared-1',
    });
  });

  it('omite targetRef cuando el drop no lo incluye', () => {
    const ref = productDropToRef({ marketplaceItemId: 'm2', stageX: 0, stageY: 0 }, 'ref-2');
    expect(ref.targetRef).toBeUndefined();
    expect(ref.marketplaceItemId).toBe('m2');
  });
});
