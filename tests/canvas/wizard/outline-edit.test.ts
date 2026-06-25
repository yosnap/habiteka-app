import { describe, it, expect } from 'vitest';
import {
  moveVertexOrtho,
  insertVertexOnEdge,
  removeVertex,
  isValidOutline,
} from '@/canvas/wizard/outline-edit';
import type { FloorVertex } from '@/canvas/types';

// Rectángulo horario: TL, TR, BR, BL.
const rect: FloorVertex[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];

/** ¿Todas las aristas son axis-aligned? */
function isOrthogonal(o: FloorVertex[]): boolean {
  const n = o.length;
  for (let i = 0; i < n; i++) {
    const a = o[i]!;
    const b = o[(i + 1) % n]!;
    const h = Math.abs(a.y - b.y) < 1e-6;
    const v = Math.abs(a.x - b.x) < 1e-6;
    if (h === v) return false;
  }
  return true;
}

describe('moveVertexOrtho: mantiene la ortogonalidad', () => {
  it('mover la esquina TR arrastra a sus vecinos que comparten coordenada', () => {
    // TR (i=1) de (100,0) a (140,20). El vecino TL (i=0) compartía Y=0 → toma y=20.
    // El vecino BR (i=2) compartía X=100 → toma x=140.
    const out = moveVertexOrtho(rect, 1, 140, 20);
    expect(out[1]).toEqual({ x: 140, y: 20 });
    expect(out[0]).toEqual({ x: 0, y: 20 }); // TL siguió la Y
    expect(out[2]).toEqual({ x: 140, y: 80 }); // BR siguió la X
    expect(isOrthogonal(out)).toBe(true);
  });

  it('el contorno resultante sigue siendo ortogonal tras mover cualquier vértice', () => {
    for (let i = 0; i < rect.length; i++) {
      const out = moveVertexOrtho(rect, i, rect[i]!.x + 30, rect[i]!.y - 10);
      expect(isOrthogonal(out)).toBe(true);
    }
  });
});

describe('insertVertexOnEdge', () => {
  it('inserta un vértice en el punto medio de la arista y mantiene el polígono cerrado', () => {
    const out = insertVertexOnEdge(rect, 0); // arista TL→TR
    expect(out).toHaveLength(5);
    expect(out[1]).toEqual({ x: 50, y: 0 }); // punto medio
    expect(isValidOutline(out)).toBe(true);
  });
});

describe('removeVertex', () => {
  it('no permite quedar por debajo de 4 vértices (rectángulo mínimo)', () => {
    expect(removeVertex(rect, 0)).toBeNull();
  });

  it('quita un vértice de una L (6 vértices) y deja un polígono válido', () => {
    const l: FloorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ];
    const out = removeVertex(l, 3);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(5);
  });
});

describe('isValidOutline', () => {
  it('acepta un rectángulo', () => {
    expect(isValidOutline(rect)).toBe(true);
  });

  it('rechaza menos de 4 vértices', () => {
    expect(isValidOutline(rect.slice(0, 3))).toBe(false);
  });

  it('rechaza un polígono auto-intersectado (lazo)', () => {
    const bowtie: FloorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isValidOutline(bowtie)).toBe(false);
  });
});
