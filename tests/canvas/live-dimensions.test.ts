import { describe, it, expect } from 'vitest';
import { neighborGaps } from '@/canvas/live-dimensions';
import type { WorldRect } from '@/canvas/floating-menu-anchor';
import type { CanvasScale } from '@/canvas/types';

const SCALE: CanvasScale = { pxPerMeter: 100 }; // 100 px = 1 m

const r = (x: number, y: number, w: number, h: number): WorldRect => ({
  x,
  y,
  width: w,
  height: h,
});

// Objeto en movimiento: 100x100 en (200,200) → bordes 200..300 en ambos ejes.
const moving = r(200, 200, 100, 100);

describe('neighborGaps', () => {
  it('sin vecinos → todos undefined', () => {
    expect(neighborGaps(moving, [], SCALE)).toEqual({});
  });

  it('vecino a la derecha solapado en Y → gap derecho en metros', () => {
    // vecino en x=350 (gap 50px = 0,5 m), solapa en Y (200..300).
    const g = neighborGaps(moving, [r(350, 220, 40, 40)], SCALE);
    expect(g.right).toBeCloseTo(0.5, 5);
    expect(g.left).toBeUndefined();
  });

  it('vecino a la izquierda', () => {
    // vecino termina en x=150 (gap 50px), solapa en Y.
    const g = neighborGaps(moving, [r(100, 220, 50, 40)], SCALE);
    expect(g.left).toBeCloseTo(0.5, 5);
  });

  it('vecino arriba y abajo', () => {
    const arriba = r(220, 100, 40, 60); // termina en y=160 → gap 40px
    const abajo = r(220, 320, 40, 40); // empieza en y=320 → gap 20px
    const g = neighborGaps(moving, [arriba, abajo], SCALE);
    expect(g.top).toBeCloseTo(0.4, 5);
    expect(g.bottom).toBeCloseTo(0.2, 5);
  });

  it('vecino a la derecha SIN solape en Y → ignorado', () => {
    // vecino en y=500..540, no se proyecta sobre 200..300.
    const g = neighborGaps(moving, [r(350, 500, 40, 40)], SCALE);
    expect(g.right).toBeUndefined();
  });

  it('toma el vecino MÁS cercano de cada lado', () => {
    const cerca = r(330, 220, 20, 40); // gap 30px
    const lejos = r(400, 220, 20, 40); // gap 100px
    const g = neighborGaps(moving, [lejos, cerca], SCALE);
    expect(g.right).toBeCloseTo(0.3, 5);
  });

  it('objeto solapado → sin cota de hueco (no hay hueco que medir)', () => {
    // Un vecino que solapa el borde no está "a un lado": no produce cota (el solape
    // se ve directamente). Solo cuenta como vecino el que está claramente enfrente.
    const solapa = r(280, 220, 60, 40); // cruza el borde derecho (300) del moving
    const g = neighborGaps(moving, [solapa], SCALE);
    expect(g.right).toBeUndefined();
  });

  it('vecino justo pegado (gap 0 real) → 0', () => {
    // Su izquierda coincide con la derecha del moving (300): tocan sin solapar.
    const pegado = r(300, 220, 40, 40);
    const g = neighborGaps(moving, [pegado], SCALE);
    expect(g.right).toBe(0);
  });
});
