/**
 * Extremos del eje de un muro e imán de extremos: la base de "cerrar esquinas
 * al dibujar" (aterrizar exacto en el vértice del muro vecino).
 */
import { describe, expect, it } from 'vitest';
import { nearestWallEndpoint, wallAxisEndpoints } from '@/canvas/wall-endpoints';
import { segmentToWall } from '@/canvas/draw-wall';
import type { StructObj } from '@/canvas/types';

describe('wallAxisEndpoints', () => {
  it('recupera los extremos originales de un muro dibujado (ida y vuelta con segmentToWall)', () => {
    const p1 = { x: 100, y: 200 };
    const p2 = { x: 400, y: 200 };
    const wall = segmentToWall('w1', p1, p2, { pxPerMeter: 100 })!;
    const axis = wallAxisEndpoints(wall)!;
    expect(axis.p1.x).toBeCloseTo(p1.x, 6);
    expect(axis.p1.y).toBeCloseTo(p1.y, 6);
    expect(axis.p2.x).toBeCloseTo(p2.x, 6);
    expect(axis.p2.y).toBeCloseTo(p2.y, 6);
  });

  it('también con muros diagonales (rotación arbitraria)', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 250 };
    const wall = segmentToWall('w2', p1, p2, { pxPerMeter: 100 })!;
    const axis = wallAxisEndpoints(wall)!;
    expect(axis.p1.x).toBeCloseTo(p1.x, 6);
    expect(axis.p2.y).toBeCloseTo(p2.y, 6);
  });

  it('muro de plantilla horizontal: extremos en el eje central', () => {
    const template: StructObj = {
      id: 'w3',
      kind: 'wall',
      x: 50,
      y: 80,
      width: 300,
      height: 12,
      rotation: 0,
    };
    const axis = wallAxisEndpoints(template)!;
    expect(axis.p1).toEqual({ x: 50, y: 86 });
    expect(axis.p2).toEqual({ x: 350, y: 86 });
  });

  it('devuelve null para objetos que no son muros', () => {
    const sofa = { id: 's', kind: 'sofa', x: 0, y: 0, width: 90, height: 40, rotation: 0 };
    expect(wallAxisEndpoints(sofa as StructObj)).toBeNull();
  });
});

describe('nearestWallEndpoint', () => {
  const wall = segmentToWall('w1', { x: 100, y: 100 }, { x: 400, y: 100 }, { pxPerMeter: 100 })!;

  it('imanta a un extremo dentro de la tolerancia y elige el más cercano', () => {
    const near = nearestWallEndpoint({ x: 108, y: 95 }, [wall], 14)!;
    expect(near.x).toBeCloseTo(100, 6);
    expect(near.y).toBeCloseTo(100, 6);
  });

  it('no imanta fuera de la tolerancia ni al centro del muro', () => {
    expect(nearestWallEndpoint({ x: 130, y: 100 }, [wall], 14)).toBeNull();
    expect(nearestWallEndpoint({ x: 250, y: 100 }, [wall], 14)).toBeNull();
  });
});
