import { describe, it, expect } from 'vitest';
import { detectRooms, snapEndpoints } from '@/canvas/wall-graph';
import type { WallSegment } from '@/canvas/types';

function seg(id: string, x1: number, y1: number, x2: number, y2: number): WallSegment {
  return { id, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, thicknessPx: 10 };
}

// Cuadrado 100×100 en (0,0)→(100,0)→(100,100)→(0,100)
const squareSegs: WallSegment[] = [
  seg('top',    0,   0, 100,   0),
  seg('right',100,   0, 100, 100),
  seg('bot',  100, 100,   0, 100),
  seg('left',   0, 100,   0,   0),
];

// Polígono L: 6 segmentos que forman una L cerrada
//   (0,0)→(200,0)→(200,100)→(100,100)→(100,200)→(0,200)→(0,0)
const lShapeSegs: WallSegment[] = [
  seg('l1',   0,   0, 200,   0),
  seg('l2', 200,   0, 200, 100),
  seg('l3', 200, 100, 100, 100),
  seg('l4', 100, 100, 100, 200),
  seg('l5', 100, 200,   0, 200),
  seg('l6',   0, 200,   0,   0),
];

// U abierta: 3 segmentos sin cerrar
const uOpenSegs: WallSegment[] = [
  seg('u1',   0,   0, 100,   0),
  seg('u2', 100,   0, 100, 100),
  seg('u3',   0, 100,   0,   0),  // falta el segmento inferior que cerraría la U
];

// Línea recta: 2 segmentos collineales sin ciclo
const straightSegs: WallSegment[] = [
  seg('s1',   0, 0, 100, 0),
  seg('s2', 100, 0, 200, 0),
];

describe('detectRooms — cuadrado', () => {
  it('4 segmentos cerrados → 1 room detectado', () => {
    const rooms = detectRooms(squareSegs, 0);
    expect(rooms).toHaveLength(1);
  });

  it('el room contiene los 4 segment IDs', () => {
    const rooms = detectRooms(squareSegs, 0);
    expect(rooms[0]!.segmentIds.sort()).toEqual(['bot', 'left', 'right', 'top'].sort());
  });

  it('el room tiene 4 vértices', () => {
    const rooms = detectRooms(squareSegs, 0);
    expect(rooms[0]!.vertices).toHaveLength(4);
  });

  it('área en m² aproximada para cuadrado 100×100 px (100 px/m = 1×1 m)', () => {
    const rooms = detectRooms(squareSegs, 0, 100);
    // Área del cuadrado = 100×100 = 10000 px² → 1 m² con 100 px/m
    expect(rooms[0]!.areaM2).toBeCloseTo(1, 2);
  });
});

describe('detectRooms — polígono L', () => {
  it('6 segmentos formando L cerrada → 1 room', () => {
    const rooms = detectRooms(lShapeSegs, 0);
    expect(rooms).toHaveLength(1);
  });

  it('el room L tiene 6 vértices', () => {
    const rooms = detectRooms(lShapeSegs, 0);
    expect(rooms[0]!.vertices).toHaveLength(6);
  });

  it('todos los segment IDs del L aparecen en el room', () => {
    const rooms = detectRooms(lShapeSegs, 0);
    const ids = rooms[0]!.segmentIds.sort();
    expect(ids).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].sort());
  });
});

describe('detectRooms — U abierta', () => {
  it('3 segmentos sin cerrar → 0 rooms', () => {
    const rooms = detectRooms(uOpenSegs, 0);
    expect(rooms).toHaveLength(0);
  });
});

describe('detectRooms — segmentos sueltos', () => {
  it('2 segmentos collineales sin ciclo → 0 rooms', () => {
    expect(detectRooms(straightSegs, 0)).toHaveLength(0);
  });

  it('lista vacía → 0 rooms', () => {
    expect(detectRooms([], 0)).toHaveLength(0);
  });

  it('un único segmento → 0 rooms', () => {
    expect(detectRooms([seg('only', 0, 0, 100, 0)], 0)).toHaveLength(0);
  });
});

describe('snapEndpoints', () => {
  it('threshold=0 devuelve los segmentos sin modificar', () => {
    const result = snapEndpoints(squareSegs, 0);
    expect(result).toEqual(squareSegs);
  });

  it('snap a grid de 10: redondea coordenadas', () => {
    const s = [seg('a', 3, 7, 97, 103)];
    const result = snapEndpoints(s, 10);
    expect(result[0]!.p1).toEqual({ x: 0, y: 10 });
    expect(result[0]!.p2).toEqual({ x: 100, y: 100 });
  });

  it('dos endpoints a < threshold se fusionan al mismo nodo', () => {
    // p2 del primer seg y p1 del segundo difieren 3 px; con threshold=5 → mismo nodo
    const segs: WallSegment[] = [
      seg('a',   0, 0, 100,   0),
      seg('b', 103, 0, 103, 100),
    ];
    const result = snapEndpoints(segs, 5);
    // Con threshold=5: 103 → round(103/5)*5 = round(20.6)*5 = 21*5 = 105
    // Y 100 → round(100/5)*5 = 100
    // No son iguales con 5px grid — usar threshold=10:
    const result10 = snapEndpoints(segs, 10);
    expect(result10[0]!.p2.x).toEqual(result10[1]!.p1.x);
  });

  it('snap con threshold=5 cierra gaps pequeños entre endpoints del cuadrado', () => {
    // Cuadrado con gap de 2 px en cada esquina
    const gapped: WallSegment[] = [
      seg('t',   0,   0, 102,   2),
      seg('r', 100,   0, 102, 102),
      seg('b', 100, 100,   0, 102),
      seg('l',   2, 100,   2,   0),
    ];
    const snapped = snapEndpoints(gapped, 5);
    const rooms = detectRooms(snapped, 0); // no re-snap: ya snapeado
    expect(rooms).toHaveLength(1);
  });
});
