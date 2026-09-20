import { describe, expect, it } from 'vitest';
import type { PlanZone } from '@/lib/contracts';
import { placeFurniture, roomFromZoneName } from '@/server/ai/sketch/place-furniture';

// Imagen de 10 m × 8 m: 1 unidad = 10 000 mm en x, 8 000 mm en y.
const scale = { mmPerUnitX: 10000, mmPerUnitY: 8000 };

function zone(id: string, name: string, x0: number, y0: number, x1: number, y1: number): PlanZone {
  return {
    id, name, walls: [], apertures: [], dimensions: [],
    outline: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
  };
}
const zones = [zone('dorm', 'Dormitorio principal', 0, 0, 4000, 4000), zone('bano', 'B°1', 4000, 0, 6000, 2500)];

describe('roomFromZoneName', () => {
  it('reconoce nombres habituales con y sin tildes', () => {
    expect(roomFromZoneName('Dorm. Principal')).toBe('dormitorio');
    expect(roomFromZoneName('Salón-comedor')).toBe('comedor');
    expect(roomFromZoneName('B°2')).toBe('bano');
    expect(roomFromZoneName('Terraza posterior')).toBe('exterior');
    expect(roomFromZoneName('Estancia')).toBeNull();
  });
});

describe('placeFurniture', () => {
  it('coloca una cama del catálogo de dormitorio centrada en su caja con el giro leído', () => {
    const { furniture, warnings } = placeFurniture(
      [{ tipo: 'bed', bbox: { minX: 0.05, minY: 0.05, maxX: 0.21, maxY: 0.31 }, rotacionDeg: 0 }],
      scale, zones,
    );
    expect(warnings).toEqual([]);
    expect(furniture).toHaveLength(1);
    const bed = furniture[0]!;
    expect(bed.kind).toMatch(/cama/);
    expect(bed.zoneId).toBe('dorm');
    expect(bed.rotation).toBe(0);
    // Caja 1600 × 2080 mm → cama doble (1600 × 2100), centrada en (1300, 1440).
    expect(bed.widthMm).toBe(1600);
    expect(Math.abs(bed.x - 1300)).toBeLessThan(5);
    expect(Math.abs(bed.y - 1440)).toBeLessThan(5);
  });

  it('elige la entrada de la estancia del plano: un inodoro en el baño', () => {
    const { furniture } = placeFurniture(
      [{ tipo: 'toilet', bbox: { minX: 0.42, minY: 0.05, maxX: 0.46, maxY: 0.14 }, rotacionDeg: 0 }],
      scale, zones,
    );
    expect(furniture[0]!.zoneId).toBe('bano');
    expect(furniture[0]!.kind).toMatch(/inodoro/);
  });

  it('descarta con aviso un mueble fuera de toda estancia y uno que no cabe en la suya', () => {
    const { furniture, warnings } = placeFurniture(
      [
        { tipo: 'sofa', bbox: { minX: 0.8, minY: 0.8, maxX: 0.95, maxY: 0.9 }, rotacionDeg: 0 },
        // Bañera de 1700 en un baño de 2000 de ancho, dibujada casi fuera (centro en x = 5900).
        { tipo: 'bath', bbox: { minX: 0.5, minY: 0.05, maxX: 0.68, maxY: 0.14 }, rotacionDeg: 0 },
      ],
      scale, zones,
    );
    expect(furniture).toEqual([]);
    expect(warnings.map((w) => w.code)).toEqual(['mueble-fuera-de-estancia', 'mueble-fuera-de-estancia']);
  });

  it('recoloca dentro de la estancia un mueble con desbordamiento pequeño', () => {
    // Mesita de 450 cuyo centro leído queda a 100 mm del muro: se pega al muro.
    const { furniture } = placeFurniture(
      [{ tipo: 'cabinet', bbox: { minX: 0.0, minY: 0.1, maxX: 0.04, maxY: 0.15 }, rotacionDeg: 0 }],
      scale, zones,
    );
    expect(furniture).toHaveLength(1);
    expect(furniture[0]!.x - furniture[0]!.widthMm / 2).toBeGreaterThanOrEqual(0);
  });

  it('avisa cuando el tipo no tiene pieza en el catálogo', () => {
    const { furniture, warnings } = placeFurniture(
      [{ tipo: 'car', bbox: { minX: 0.1, minY: 0.1, maxX: 0.3, maxY: 0.4 }, rotacionDeg: 0 }],
      scale, zones,
    );
    expect(furniture).toEqual([]);
    expect(warnings[0]!.code).toBe('mueble-sin-catalogo');
  });
});
