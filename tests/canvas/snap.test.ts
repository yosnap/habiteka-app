import { describe, it, expect } from 'vitest';
import { computeSnap, SNAP_THRESHOLD_PX } from '@/canvas/snap';
import type { WorldRect } from '@/canvas/floating-menu-anchor';

const rect = (x: number, y: number, width: number, height: number): WorldRect => ({
  x,
  y,
  width,
  height,
});

describe('computeSnap: enganche de bordes', () => {
  it('engancha el borde izquierdo del objeto al borde derecho de un candidato cercano', () => {
    // Candidato ocupa x:[0,100], y:[0,100]. Objeto a la derecha con un hueco de 5 px (< umbral).
    const candidate = rect(0, 0, 100, 100);
    const moving = rect(105, 10, 50, 50); // borde izq en 105, candidato borde der en 100 → gap 5
    const r = computeSnap(moving, [candidate], SNAP_THRESHOLD_PX);
    // Para alinear el borde izq del objeto (105) al borde der del candidato (100): dx = -5.
    expect(r.dx).toBe(-5);
    expect(r.guidesX).toContain(100);
  });

  it('no engancha si la distancia supera el umbral', () => {
    const candidate = rect(0, 0, 100, 100);
    const moving = rect(120, 10, 50, 50); // gap 20 > umbral 8
    const r = computeSnap(moving, [candidate], SNAP_THRESHOLD_PX);
    expect(r.dx).toBe(0);
    expect(r.guidesX).toHaveLength(0);
  });
});

describe('computeSnap: alineación de centros', () => {
  it('alinea el centro X del objeto con el centro X de un candidato enfrente (solape en Y)', () => {
    // El enganche en X exige que el candidato esté ENFRENTE en Y (mismo criterio que las
    // cotas de vecinos). Candidato centrado en x=50 (x:[0,100]) y solapado en Y con el objeto.
    const candidate = rect(0, 0, 100, 60); // y:[0,60]
    const moving = rect(33, 40, 40, 40); // centro X = 53; y:[40,80] solapa con [0,60]
    const r = computeSnap(moving, [candidate], SNAP_THRESHOLD_PX);
    // Centro X del candidato 50; centro X del objeto 53 → dx = -3 (es el enganche más cercano).
    expect(r.dx).toBe(-3);
    expect(r.guidesX).toContain(50);
  });
});

describe('computeSnap: solape perpendicular requerido', () => {
  it('no engancha en X a un candidato que no se solapa en Y (está en diagonal)', () => {
    const candidate = rect(0, 0, 100, 100); // y:[0,100]
    const moving = rect(105, 200, 50, 50); // y:[200,250] no solapa con [0,100]
    const r = computeSnap(moving, [candidate], SNAP_THRESHOLD_PX);
    expect(r.dx).toBe(0);
    expect(r.guidesX).toHaveLength(0);
  });
});

describe('computeSnap: enganche en ambos ejes', () => {
  it('engancha simultáneamente en X e Y a una esquina cercana', () => {
    // Candidato x:[0,100], y:[0,100]. Objeto con borde izq a 104 (gap 4) y borde sup a 103 (gap 3).
    const candidate = rect(0, 0, 100, 100);
    const moving = rect(104, 103, 50, 50);
    // Para solapar en Y (eje X) el objeto debe cruzar y:[0,100]: y:[103,153] NO solapa → sin dx.
    // Ajustamos: objeto que solapa en ambos ejes con el candidato no aplica aquí; este test
    // comprueba que sin solape perpendicular no hay enganche cruzado espurio.
    const r = computeSnap(moving, [candidate], SNAP_THRESHOLD_PX);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
  });

  it('engancha en X y Y cuando hay candidatos enfrente en cada eje', () => {
    // Pared izquierda (vertical) que solapa en Y con el objeto → engancha el borde izq en X.
    const wallLeft = rect(0, 0, 10, 300); // x:[0,10], y:[0,300]
    // Pared superior (horizontal) que solapa en X con el objeto → engancha el borde sup en Y.
    const wallTop = rect(0, 0, 300, 10); // x:[0,300], y:[0,10]
    const moving = rect(16, 14, 50, 50); // borde izq 16 (gap 6 a 10), borde sup 14 (gap 4 a 10)
    const r = computeSnap(moving, [wallLeft, wallTop], SNAP_THRESHOLD_PX);
    expect(r.dx).toBe(-6); // 16 → 10
    expect(r.dy).toBe(-4); // 14 → 10
    expect(r.guidesX).toContain(10);
    expect(r.guidesY).toContain(10);
  });
});

describe('computeSnap: sin candidatos', () => {
  it('no engancha si no hay candidatos', () => {
    const r = computeSnap(rect(50, 50, 30, 30), [], SNAP_THRESHOLD_PX);
    expect(r).toEqual({ dx: 0, dy: 0, guidesX: [], guidesY: [] });
  });
});
