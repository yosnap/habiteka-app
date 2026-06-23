import { describe, it, expect } from 'vitest';
import { floorPolygonFromWalls, type FloorPoint } from '@/canvas/3d/floor-from-walls';
import type { StructObj } from '@/canvas/types';

const wall = (x: number, y: number, width: number, height: number, rotation = 0): StructObj => ({
  id: `w-${x}-${y}`,
  kind: 'wall',
  x,
  y,
  width,
  height,
  rotation,
});

/** Área (en valor absoluto) de un polígono por la fórmula del cordón (shoelace). */
function area(pts: FloorPoint[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** bbox de un polígono. */
function bbox(pts: FloorPoint[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

describe('floorPolygonFromWalls: huella de una sala rectangular', () => {
  // 4 muros de un rectángulo cuyo contorno exterior es [100,100]–[500,400].
  const rectWalls = [
    wall(100, 100, 400, 15), // top
    wall(100, 385, 400, 15), // bottom
    wall(100, 100, 15, 300), // left
    wall(485, 100, 15, 300), // right
  ];

  it('devuelve un cuadrilátero que cubre la huella exterior de los muros', () => {
    const poly = floorPolygonFromWalls(rectWalls);
    expect(poly).not.toBeNull();
    const bb = bbox(poly!);
    // El contorno debe abarcar el bbox exterior de los muros (con tolerancia de 1 celda).
    expect(bb.minX).toBeLessThanOrEqual(105);
    expect(bb.minY).toBeLessThanOrEqual(105);
    expect(bb.maxX).toBeGreaterThanOrEqual(495);
    expect(bb.maxY).toBeGreaterThanOrEqual(395);
    // Rectángulo simplificado → 4 vértices.
    expect(poly!.length).toBe(4);
  });
});

describe('floorPolygonFromWalls: sala en L (huella con escalón)', () => {
  // Sala L editada a mano (muros del doc real del usuario).
  const lWalls = [
    wall(105, 105, 430, 15),
    wall(520, 120, 15, 150),
    wall(380, 260, 165, 20),
    wall(370, 270, 15, 150),
    wall(105, 420, 280, 15),
    wall(105, 120, 15, 300),
  ];

  it('el contorno sigue la huella REAL de los muros (no un floorOutline congelado)', () => {
    const poly = floorPolygonFromWalls(lWalls);
    expect(poly).not.toBeNull();
    // Una L tiene un escalón → más de 4 vértices.
    expect(poly!.length).toBeGreaterThan(4);
    // El recorte (esquina inferior-derecha) reduce el área frente al bbox completo.
    const bb = bbox(poly!);
    const bboxArea = (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
    expect(area(poly!)).toBeLessThan(bboxArea);
    // El contorno incluye el muro del escalón, que llega hasta x≈545 (su cara externa).
    expect(bb.maxX).toBeGreaterThanOrEqual(535);
  });
});

describe('floorPolygonFromWalls: casos límite', () => {
  it('devuelve null con menos de 3 muros', () => {
    expect(floorPolygonFromWalls([wall(0, 0, 100, 15), wall(0, 0, 15, 100)])).toBeNull();
  });
});
