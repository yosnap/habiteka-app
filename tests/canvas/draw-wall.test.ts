import { describe, it, expect } from 'vitest';
import {
  segmentToWall,
  segmentLengthPx,
  segmentAngleDeg,
  isValidSegment,
  MIN_WALL_LENGTH_PX,
  DEFAULT_WALL_THICKNESS_M,
} from '@/canvas/draw-wall';
import { objectCenterPx } from '@/canvas/3d/doc-to-scene';
import type { CanvasScale } from '@/canvas/types';

const scale100: CanvasScale = { pxPerMeter: 100 };

describe('draw-wall: longitud y ángulo del segmento', () => {
  it('longitud = distancia euclídea', () => {
    expect(segmentLengthPx({ x: 0, y: 0 }, { x: 300, y: 0 })).toBe(300);
    expect(segmentLengthPx({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50);
  });

  it('ángulo: horizontal=0°, vertical hacia abajo=90°, 45°', () => {
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(45);
  });
});

describe('draw-wall: rechazo de segmentos degenerados', () => {
  it('un segmento más corto que el mínimo no es válido', () => {
    expect(isValidSegment({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
    expect(isValidSegment({ x: 0, y: 0 }, { x: MIN_WALL_LENGTH_PX, y: 0 })).toBe(true);
  });

  it('segmentToWall devuelve null para un punto repetido', () => {
    expect(segmentToWall('w', { x: 100, y: 100 }, { x: 100, y: 100 }, scale100)).toBeNull();
  });
});

describe('draw-wall: segmentToWall produce un muro coherente', () => {
  it('width = longitud, rotation = ángulo, grosor de la escala (0,15 m = 15 px)', () => {
    const w = segmentToWall('w', { x: 100, y: 100 }, { x: 400, y: 100 }, scale100)!;
    expect(w.kind).toBe('wall');
    expect(w.width).toBeCloseTo(300);
    expect(w.rotation).toBeCloseTo(0);
    expect(w.height).toBeCloseTo(15); // 0,15 m × 100 px/m
  });

  it('sin escala usa un grosor por defecto visible', () => {
    const w = segmentToWall('w', { x: 0, y: 0 }, { x: 200, y: 0 }, null)!;
    expect(w.height).toBe(12);
  });

  it('el grosor usa thicknessM dado', () => {
    const w = segmentToWall('w', { x: 0, y: 0 }, { x: 200, y: 0 }, scale100, 0.3)!;
    expect(w.height).toBeCloseTo(30);
  });
});

describe('draw-wall: el muro casa con el pivote 3D (centro sobre el punto medio del segmento)', () => {
  // Verifica la coherencia con el fix de pivote (F7.2): el centro del muro calculado como
  // lo hace docToScene (objectCenterPx, rota sobre la esquina) debe caer en el PUNTO MEDIO
  // del segmento dibujado, para cualquier ángulo.
  const cases = [
    { p1: { x: 100, y: 100 }, p2: { x: 400, y: 100 } }, // horizontal
    { p1: { x: 200, y: 100 }, p2: { x: 200, y: 400 } }, // vertical (90°)
    { p1: { x: 100, y: 100 }, p2: { x: 400, y: 400 } }, // diagonal 45°
    { p1: { x: 400, y: 200 }, p2: { x: 100, y: 350 } }, // ángulo arbitrario hacia atrás
  ];

  for (const { p1, p2 } of cases) {
    it(`centro 3D = punto medio para el segmento (${p1.x},${p1.y})→(${p2.x},${p2.y})`, () => {
      const w = segmentToWall('w', p1, p2, scale100)!;
      const [cx, cy] = objectCenterPx(w);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      expect(cx).toBeCloseTo(midX, 1);
      expect(cy).toBeCloseTo(midY, 1);
    });
  }
});

describe('draw-wall: defaults', () => {
  it('el grosor por defecto es 15 cm', () => {
    expect(DEFAULT_WALL_THICKNESS_M).toBeCloseTo(0.15);
  });
});
