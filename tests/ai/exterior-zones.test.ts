import { describe, expect, it } from 'vitest';
import type { PlanWall, PlanZone } from '@/lib/contracts';
import { buildExteriorZones } from '@/server/ai/sketch/exterior-zones';

const scale = { mmPerUnitX: 10000, mmPerUnitY: 10000 };
const wall = (id: string, x1: number, y1: number, x2: number, y2: number): PlanWall => ({
  id, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, thicknessMm: 200,
});
// Fachada sur de la casa en y = 5000, de x = 0 a 6000.
const walls = [wall('sur', 0, 5000, 6000, 5000), wall('oeste', 0, 0, 0, 5000)];
const square = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

describe('buildExteriorZones', () => {
  it('crea la terraza pegada a la fachada con tres límites ocultos (el cuarto es el muro)', () => {
    const { exteriors, warnings } = buildExteriorZones(
      [{ nombre: 'Terraza', exterior: true, poligono: square(0.1, 0.5, 0.5, 0.75) }],
      scale, [], walls,
    );
    expect(warnings).toEqual([]);
    expect(exteriors).toHaveLength(1);
    const t = exteriors[0]!;
    expect(t.name).toBe('Terraza');
    expect(t.outline[0]).toEqual({ x: 1000, y: 5000 });
    // El lado superior (y = 5000) coincide con la fachada: no es límite oculto.
    expect(t.hiddenBoundaries).toHaveLength(3);
    expect(t.hiddenBoundaries.some((b) => b.from.y === 5000 && b.to.y === 5000)).toBe(false);
  });

  it('reutiliza una estancia cerrada existente con el mismo nombre en lugar de duplicarla', () => {
    const patio: PlanZone = {
      id: 'z3', name: 'Patio interior', walls: [], apertures: [], dimensions: [],
      outline: square(2000, 2000, 5000, 5000),
    };
    const { exteriors } = buildExteriorZones(
      [{ nombre: 'Patio interior', exterior: true, poligono: square(0.22, 0.22, 0.48, 0.48) }],
      scale, [patio], walls,
    );
    expect(exteriors[0]!.id).toBe('z3');
    // Patio cerrado por muros por los cuatro lados: ningún límite oculto salvo los lados sin muro.
    expect(exteriors[0]!.outline).toHaveLength(4);
  });

  it('ignora estancias interiores y avisa de exteriores sin contorno útil', () => {
    const { exteriors, warnings } = buildExteriorZones(
      [
        { nombre: 'Salón', poligono: square(0.1, 0.1, 0.4, 0.4) },
        { nombre: 'Balcón', exterior: true, poligono: square(0.1, 0.1, 0.12, 0.12) },
      ],
      scale, [], walls,
    );
    expect(exteriors).toEqual([]);
    expect(warnings[0]!.code).toBe('zona-exterior-sin-contorno');
  });
});
