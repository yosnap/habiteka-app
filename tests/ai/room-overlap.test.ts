import { describe, expect, it } from 'vitest';
import { mergeOpenPlanRooms, type RoomShape } from '@/server/ai/sketch/room-overlap';

const rectangle = (name: string, x0: number, x1: number): RoomShape => {
  const points = [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 0.5 }, { x: x0, y: 0.5 }];
  return { room: { nombre: name, poligono: points }, points };
};

describe('espacios solapados', () => {
  it('une etiquetas de una estancia abierta sin inventar una pared entre ellas', () => {
    const result = mergeOpenPlanRooms([rectangle('Salón', 0, 0.5), rectangle('Comedor', 0.4, 0.9)], []);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0]!.room.nombre).toBe('Salón / Comedor');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'estancias-fusionadas' }));
  });

  it('conserva estancias separadas si el raster mide un tabique sólido en el solape', () => {
    const result = mergeOpenPlanRooms(
      [rectangle('Salón', 0, 0.5), rectangle('Comedor', 0.4, 0.9)],
      [{ x1: 0.45, y1: 0.05, x2: 0.45, y2: 0.45, thickness: 0.012 }],
    );
    expect(result.shapes).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('ignora trazos del perímetro y muebles al decidir si dos zonas abiertas se separan', () => {
    const kitchen = rectangle('COCINA', 0.4, 0.9);
    const dining = rectangle('COMEDOR', 0.5, 1);
    const result = mergeOpenPlanRooms([kitchen, dining], [
      { x1: 0.89, y1: 0.02, x2: 0.89, y2: 0.48, thickness: 0.01 },
      { x1: 0.53, y1: 0.02, x2: 0.60, y2: 0.02, thickness: 0.01 },
    ]);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0]!.room.nombre).toBe('COCINA / COMEDOR');
  });
});
