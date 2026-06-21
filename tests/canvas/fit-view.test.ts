import { describe, it, expect } from 'vitest';
import { fitToContent } from '@/canvas/fit-view';
import type { StructObj } from '@/canvas/types';

const obj = (x: number, y: number, w: number, h: number): StructObj => ({
  id: `${x}-${y}`,
  kind: 'wall',
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
});

const opts = { minScale: 0.2, maxScale: 4, marginRatio: 0.1 };

describe('fitToContent', () => {
  it('sin objetos devuelve la vista identidad', () => {
    expect(fitToContent([], 800, 600, opts)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('centra el contenido en el viewport', () => {
    // Contenido de 200×200 centrado en (100,100); viewport 800×600.
    const view = fitToContent([obj(0, 0, 200, 200)], 800, 600, opts);
    // El centro del contenido (100,100) debe caer en el centro del viewport (400,300).
    expect(100 * view.scale + view.x).toBeCloseTo(400, 5);
    expect(100 * view.scale + view.y).toBeCloseTo(300, 5);
  });

  it('escala para que el contenido quepa con margen, sin pasar el máximo', () => {
    // Contenido diminuto: la escala se acota a maxScale (no zoom infinito).
    const view = fitToContent([obj(0, 0, 10, 10)], 800, 600, opts);
    expect(view.scale).toBe(4);
  });

  it('reduce el zoom si el contenido es más grande que el viewport', () => {
    const view = fitToContent([obj(0, 0, 4000, 3000)], 800, 600, opts);
    expect(view.scale).toBeLessThan(1);
    expect(view.scale).toBeGreaterThanOrEqual(0.2);
  });

  it('encuadra el bounding box de varios objetos dispersos', () => {
    const view = fitToContent([obj(0, 0, 50, 50), obj(450, 350, 50, 50)], 800, 600, opts);
    // Centro del bbox (0..500, 0..400) = (250, 200) → centro del viewport.
    expect(250 * view.scale + view.x).toBeCloseTo(400, 5);
    expect(200 * view.scale + view.y).toBeCloseTo(300, 5);
  });
});
