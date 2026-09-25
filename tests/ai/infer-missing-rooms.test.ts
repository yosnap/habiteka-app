import { describe, expect, it } from 'vitest';
import type { PlanZone } from '@/lib/contracts';
import type { SketchRoom } from '@/server/ai/sketch/sketch-types';
import { inferMissingRooms } from '@/server/ai/sketch/infer-missing-rooms';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const region = (x0: number, y0: number, x1: number, y1: number): PlanZone => ({
  id: `${x0}-${y0}`, name: 'Estancia', outline: rect(x0, y0, x1, y1),
  walls: [], apertures: [], dimensions: [],
});

describe('inferMissingRooms', () => {
  it('recupera una sala grande omitida y descarta una banda exterior y zonas ya leídas', () => {
    const rooms: SketchRoom[] = [
      { nombre: 'Dormitorios', poligono: rect(0.1, 0.1, 0.5, 0.5) },
      { nombre: 'Cocina / Comedor', poligono: rect(0.5, 0.5, 0.9, 0.9) },
      { nombre: 'Portal', poligono: rect(0.1, 0.8, 0.5, 0.9), exterior: true },
    ];
    const missing = inferMissingRooms(rooms, [
      region(1100, 5100, 4900, 7900),
      region(9100, 2000, 9800, 8000),
      region(1100, 1100, 4900, 4900),
    ], { mmPerUnitX: 10000, mmPerUnitY: 10000 });
    expect(missing).toEqual([{ nombre: 'Estancia sin identificar 1', poligono: rect(0.1, 0.5, 0.5, 0.8) }]);
  });
});
