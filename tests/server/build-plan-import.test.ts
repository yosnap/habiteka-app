/**
 * Orquestación de la importación sobre una extracción sintética: dos estancias
 * con cotas escritas, una terraza exterior y una cama dibujada. Sin IA ni BD.
 */
import { describe, expect, it } from 'vitest';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import { buildPlanImport } from '@/server/plan/build-plan-import';

// Casa de 6 × 4 m (escala fiable: la caja de muros mide eso). Ocupa 0.1–0.7
// en x y 0.1–0.5 en y, tabique en x = 0.4. Terraza debajo (0.1–0.7, 0.5–0.7).
function raw(): RawSketch {
  const sq = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];
  return {
    anchoMetros: 6, altoMetros: 4, escalaFiable: true,
    muros: [
      { x1: 0.1, y1: 0.1, x2: 0.7, y2: 0.1 },
      { x1: 0.1, y1: 0.5, x2: 0.7, y2: 0.5 },
      { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.5 },
      { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.5 },
      { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.5 },
    ],
    aberturas: [],
    habitaciones: [
      // Medida escrita 3,20 × 4,00 (la dibujada es 3,00 × 4,00 entre ejes).
      { nombre: 'Dormitorio', poligono: sq(0.1, 0.1, 0.4, 0.5), anchoMetros: 3.2, altoMetros: 4 },
      { nombre: 'Salón', poligono: sq(0.4, 0.1, 0.7, 0.5) },
      { nombre: 'Terraza', poligono: sq(0.1, 0.5, 0.7, 0.7), exterior: true },
    ],
    mobiliario: [
      { tipo: 'bed', bbox: { minX: 0.15, minY: 0.15, maxX: 0.31, maxY: 0.36 }, rotacionDeg: 0 },
    ],
  };
}

describe('buildPlanImport', () => {
  it('normaliza, ajusta la cota escrita, crea la terraza y coloca la cama', () => {
    const result = buildPlanImport(raw());
    expect(result.escalaEstimada).toBe(false);
    expect(result.warnings.filter((w) => w.code === 'cota-contradictoria')).toEqual([]);

    const dorm = result.writtenDimensions.find((w) => w.name === 'Dormitorio');
    expect(dorm?.widthMm).toBe(3200);
    const correction = result.corrections.find((c) => c.zoneId === dorm!.zoneId && c.axis === 'x');
    expect(correction).toBeDefined();
    expect(Math.abs(correction!.residualMm)).toBeLessThanOrEqual(3);

    expect(result.exteriors.map((e) => e.name)).toEqual(['Terraza']);
    expect(result.exteriors[0]!.hiddenBoundaries.length).toBeGreaterThanOrEqual(3);

    expect(result.furniture).toHaveLength(1);
    expect(result.furniture[0]!.kind).toMatch(/cama/);
    expect(result.furniture[0]!.zoneId).toBe(dorm!.zoneId);
  });

  it('las correcciones de la tabla del usuario prevalecen sobre lo leído', () => {
    const first = buildPlanImport(raw());
    const dorm = first.writtenDimensions.find((w) => w.name === 'Dormitorio')!;
    const second = buildPlanImport(raw(), {
      roomOverrides: [{ ...dorm, widthMm: 3300 }],
      includeFurniture: false,
    });
    const correction = second.corrections.find((c) => c.zoneId === dorm.zoneId && c.axis === 'x');
    expect(correction?.expectedMm).toBe(3300);
    expect(second.furniture).toEqual([]);
  });
});

describe('buildPlanImport: ancho total confirmado por el usuario', () => {
  it('fija la escala con el ancho indicado y deja de ser estimada', () => {
    const sketch: RawSketch = { ...raw(), anchoMetros: undefined, altoMetros: undefined, escalaFiable: false };
    const estimated = buildPlanImport(sketch, { includeFurniture: false });
    expect(estimated.escalaEstimada).toBe(true);
    const fixed = buildPlanImport(sketch, { includeFurniture: false, generalWidthMm: 9000 });
    expect(fixed.escalaEstimada).toBe(false);
    const walls = fixed.plano.zones.flatMap((z) => z.walls);
    const xs = walls.flatMap((w) => [w.from.x, w.to.x]);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(9000);
  });
});
