import { describe, it, expect } from 'vitest';
import { buildFloorAABB, resolveFloorCollisions } from '@/canvas/3d/collision';
import type { FloorAABB } from '@/canvas/3d/collision';

// ─── buildFloorAABB ──────────────────────────────────────────────────────────

describe('buildFloorAABB — sin rotación', () => {
  it('objeto 2×1 m, 0 rad → hw=1, hd=0.5', () => {
    const box = buildFloorAABB('a', 0, 0, 2, 1, 0);
    expect(box.hw).toBeCloseTo(1, 5);
    expect(box.hd).toBeCloseTo(0.5, 5);
  });

  it('objeto cuadrado 1×1 m, 0 rad → hw=hd=0.5', () => {
    const box = buildFloorAABB('a', 0, 0, 1, 1, 0);
    expect(box.hw).toBeCloseTo(0.5, 5);
    expect(box.hd).toBeCloseTo(0.5, 5);
  });
});

describe('buildFloorAABB — rotación 90°', () => {
  it('objeto 2×1 m rotado 90° → hw=0.5, hd=1', () => {
    const box = buildFloorAABB('a', 0, 0, 2, 1, Math.PI / 2);
    expect(box.hw).toBeCloseTo(0.5, 4);
    expect(box.hd).toBeCloseTo(1, 4);
  });
});

describe('buildFloorAABB — rotación 45°', () => {
  it('objeto 2×1 m rotado 45° → hw=hd ≈ (2+1)/(2√2)', () => {
    const box = buildFloorAABB('a', 0, 0, 2, 1, Math.PI / 4);
    const expected = (Math.cos(Math.PI / 4) * 1 + Math.sin(Math.PI / 4) * 0.5);
    expect(box.hw).toBeCloseTo(expected, 5);
    expect(box.hd).toBeCloseTo(expected, 5);
  });
});

// ─── resolveFloorCollisions ──────────────────────────────────────────────────

function box(id: string, cx: number, cz: number, w = 1, d = 1): FloorAABB {
  return buildFloorAABB(id, cx, cz, w, d, 0);
}

describe('resolveFloorCollisions — sin solapamiento', () => {
  it('dos cajas separadas → posición sin cambio', () => {
    const item = box('a', 0, 0);
    const other = box('b', 3, 0); // separadas 3 m, cada hw=0.5
    const [cx, cz] = resolveFloorCollisions(item, [other]);
    expect(cx).toBeCloseTo(0, 5);
    expect(cz).toBeCloseTo(0, 5);
  });

  it('sin vecinos → posición sin cambio', () => {
    const [cx, cz] = resolveFloorCollisions(box('a', 1, 2), []);
    expect(cx).toBeCloseTo(1);
    expect(cz).toBeCloseTo(2);
  });
});

describe('resolveFloorCollisions — solapamiento en X', () => {
  it('solapamiento de 0.4 m en X → empuja hacia fuera en X', () => {
    // item en x=0, other en x=0.6 → solapamiento = 0.5+0.5-0.6 = 0.4 en X
    // solapamiento en Z = 0.5+0.5-0 = 1 (Z es mayor, empuja X)
    const item = box('a', 0, 0);
    const other = box('b', 0.6, 0);
    const [cx] = resolveFloorCollisions(item, [other]);
    // Se empuja en X: overlapX=0.4, overlapZ=1, overlapX<overlapZ → empuja X
    expect(cx).toBeCloseTo(-0.4, 4); // empujado a la izquierda (dx < 0)
  });
});

describe('resolveFloorCollisions — solapamiento en Z', () => {
  it('solapamiento de 0.3 m en Z → empuja hacia fuera en Z', () => {
    const item = box('a', 0, 0);
    const other = box('b', 0, 0.7);  // solapamiento Z = 1-0.7=0.3; X=1>0.3 → empuja Z
    const [, cz] = resolveFloorCollisions(item, [other]);
    expect(cz).toBeCloseTo(-0.3, 4);
  });
});

describe('resolveFloorCollisions — ignora propio id', () => {
  it('vecino con mismo id → no se mueve', () => {
    const item = box('a', 0, 0);
    const self = box('a', 0.1, 0); // mismo id, solapamiento obvio
    const [cx, cz] = resolveFloorCollisions(item, [self]);
    expect(cx).toBeCloseTo(0);
    expect(cz).toBeCloseTo(0);
  });
});

describe('resolveFloorCollisions — iteraciones', () => {
  it('múltiples vecinos: resuelve hasta maxIterations=3', () => {
    // item en el centro, rodeado de 4 cajas. Cada iteración empuja.
    const item = box('center', 0, 0);
    const neighbors: FloorAABB[] = [
      box('n', 0.5, 0),
      box('s', -0.5, 0),
      box('e', 0, 0.5),
      box('w', 0, -0.5),
    ];
    // No explota ni cicla infinito (con maxIterations=3 termina)
    const [cx, cz] = resolveFloorCollisions(item, neighbors, 3);
    // La posición final debe estar fuera del solapamiento con al menos alguno.
    // Solo verificamos que no crashea y devuelve números finitos.
    expect(Number.isFinite(cx)).toBe(true);
    expect(Number.isFinite(cz)).toBe(true);
  });
});
