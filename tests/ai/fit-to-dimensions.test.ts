/**
 * Solver de cotas: dos estancias contiguas con un muro compartido, contornos
 * interiores y una cota general. El ajuste debe cumplir las cotas escritas sin
 * deformar lo que no tiene cota.
 */
import { describe, expect, it } from 'vitest';
import type { Plano2dPayload, PlanWall, PlanZone } from '@/lib/contracts';
import { fitPlanToDimensions } from '@/server/ai/sketch/fit-to-dimensions';

const T = 100; // grosor de tabique (mm)

function wall(id: string, x1: number, y1: number, x2: number, y2: number, thicknessMm = T): PlanWall {
  return { id, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, thicknessMm };
}

/** Dos estancias en fila: A [0..3000] y B [3000..6000] de ancho por 4000 de alto (ejes de muro). */
function twoRooms(): Plano2dPayload {
  const walls = [
    wall('top', 0, 0, 6000, 0),
    wall('bottom', 0, 4000, 6000, 4000),
    wall('left', 0, 0, 0, 4000),
    wall('mid', 3000, 0, 3000, 4000),
    wall('right', 6000, 0, 6000, 4000),
  ];
  const half = T / 2;
  const zone = (id: string, name: string, x0: number, x1: number): PlanZone => ({
    id, name, apertures: [], dimensions: [], walls,
    outline: [
      { x: x0 + half, y: half }, { x: x1 - half, y: half },
      { x: x1 - half, y: 4000 - half }, { x: x0 + half, y: 4000 - half },
    ],
  });
  return { schemaVersion: 1, zones: [zone('a', 'A', 0, 3000), zone('b', 'B', 3000, 6000)] };
}

const measuredWidth = (z: PlanZone) => Math.max(...z.outline.map((p) => p.x)) - Math.min(...z.outline.map((p) => p.x));
const wallX = (plano: Plano2dPayload, id: string) => plano.zones[0]!.walls.find((w) => w.id === id)!.from.x;

describe('fitPlanToDimensions', () => {
  it('mueve el muro compartido para cumplir la cota de una estancia y desplaza la vecina', () => {
    // A mide 2900 interior; la cota dice 3200.
    const { plano, corrections, warnings } = fitPlanToDimensions(twoRooms(), [{ zoneId: 'a', widthMm: 3200 }]);
    expect(warnings).toEqual([]);
    expect(corrections).toHaveLength(1);
    expect(Math.abs(corrections[0]!.residualMm)).toBeLessThanOrEqual(2);
    expect(Math.abs(measuredWidth(plano.zones[0]!) - 3200)).toBeLessThanOrEqual(2);
    // El muro central se movió; los extremos apenas (anclaje débil).
    expect(wallX(plano, 'mid')).toBeGreaterThan(3200);
    expect(Math.abs(wallX(plano, 'left'))).toBeLessThan(50);
    // La topología se conserva: los muros horizontales siguen llegando al derecho.
    const top = plano.zones[0]!.walls.find((w) => w.id === 'top')!;
    expect(top.to.x).toBe(wallX(plano, 'right'));
  });

  it('con cotas en las dos estancias y cota general, reparte y cumple todas', () => {
    const { plano, corrections } = fitPlanToDimensions(
      twoRooms(),
      [{ zoneId: 'a', widthMm: 3300, heightMm: 4200 }, { zoneId: 'b', widthMm: 2700 }],
      { widthMm: 6100 }, // cara a cara: ejes = 6100 − 100
    );
    expect(corrections.every((c) => Math.abs(c.residualMm) <= 3)).toBe(true);
    expect(Math.abs(measuredWidth(plano.zones[0]!) - 3300)).toBeLessThanOrEqual(3);
    expect(Math.abs(measuredWidth(plano.zones[1]!) - 2700)).toBeLessThanOrEqual(3);
    const heightA = Math.max(...plano.zones[0]!.outline.map((p) => p.y)) - Math.min(...plano.zones[0]!.outline.map((p) => p.y));
    expect(Math.abs(heightA - 4200)).toBeLessThanOrEqual(3);
  });

  it('una cota dentro de tolerancia no cambia nada', () => {
    const before = twoRooms();
    const { plano, corrections } = fitPlanToDimensions(before, [{ zoneId: 'a', widthMm: 2950 }]);
    expect(corrections).toEqual([]);
    expect(plano).toEqual(before);
  });

  it('una cota entre ejes o entre extremos exteriores no se interpreta como luz libre', () => {
    const before = twoRooms();
    for (const widthMm of [3000, 3100]) {
      const { plano, corrections, warnings } = fitPlanToDimensions(
        before, [{ zoneId: 'a', widthMm }], undefined, { inferRoomReference: true },
      );
      expect(plano).toEqual(before);
      expect(corrections).toEqual([]);
      expect(warnings).toEqual([]);
    }
  });

  it('una cota absurda se ignora con aviso y no deforma el plano', () => {
    const before = twoRooms();
    const { plano, warnings } = fitPlanToDimensions(before, [{ zoneId: 'a', widthMm: 9000 }]);
    expect(warnings[0]!.code).toBe('cota-contradictoria');
    expect(plano.zones[0]!.walls).toEqual(before.zones[0]!.walls);
  });

  it('avisa cuando la estancia no está limitada por muros en ese eje', () => {
    const base = twoRooms();
    base.zones[0]!.outline = base.zones[0]!.outline.map((p) => ({ ...p, y: p.y + 20000 }));
    const { warnings } = fitPlanToDimensions(base, [{ zoneId: 'a', heightMm: 3000 }]);
    expect(warnings[0]!.code).toBe('cota-no-aplicable');
  });

  it('las cotas del plano se reetiquetan con la nueva longitud', () => {
    const base = twoRooms();
    base.zones[0]!.dimensions = [{ id: 'd0', from: { x: 0, y: 4000 }, to: { x: 6000, y: 4000 }, label: '6.00 m' }];
    const { plano } = fitPlanToDimensions(base, [{ zoneId: 'a', widthMm: 3500 }]);
    const d = plano.zones[0]!.dimensions[0]!;
    expect(d.label).toBe(`${((d.to.x - d.from.x) / 1000).toFixed(2)} m`);
    // Solo se movió el muro central: la cota total apenas cambia y sigue anclada a los muros extremos.
    expect(Math.abs(d.to.x - 6000)).toBeLessThan(50);
  });
});

// Tres columnas A [0..2000], B [2000..4000], C [4000..6000] por 4000 de alto.
// A y C tienen un tabique horizontal en y = 2000 que NO se toca (B no lo tiene):
// misma coordenada, muros distintos.
function threeColumns(): Plano2dPayload {
  const walls = [
    wall('top', 0, 0, 6000, 0),
    wall('bottom', 0, 4000, 6000, 4000),
    wall('left', 0, 0, 0, 4000),
    wall('ab', 2000, 0, 2000, 4000),
    wall('bc', 4000, 0, 4000, 4000),
    wall('right', 6000, 0, 6000, 4000),
    wall('midA', 0, 2000, 2000, 2000),
    wall('midC', 4000, 2000, 6000, 2000),
  ];
  const half = T / 2;
  const zone = (id: string, x0: number, x1: number, y0: number, y1: number): PlanZone => ({
    id, name: id, apertures: [], dimensions: [], walls,
    outline: [
      { x: x0 + half, y: y0 + half }, { x: x1 - half, y: y0 + half },
      { x: x1 - half, y: y1 - half }, { x: x0 + half, y: y1 - half },
    ],
  });
  return {
    schemaVersion: 1,
    zones: [
      zone('a1', 0, 2000, 0, 2000), zone('a2', 0, 2000, 2000, 4000),
      zone('b', 2000, 4000, 0, 4000),
      zone('c1', 4000, 6000, 0, 2000), zone('c2', 4000, 6000, 2000, 4000),
    ],
  };
}

const measuredHeight = (z: PlanZone) => Math.max(...z.outline.map((p) => p.y)) - Math.min(...z.outline.map((p) => p.y));

describe('fitPlanToDimensions: identidad de línea por extensión', () => {
  it('dos tabiques colineales que no se tocan se mueven de forma independiente', () => {
    // A1 mide 1900 interior y pide 2150; C1 pide 1700: correcciones opuestas sobre la misma coordenada.
    const { plano, corrections, warnings } = fitPlanToDimensions(threeColumns(), [
      { zoneId: 'a1', heightMm: 2150 },
      { zoneId: 'c1', heightMm: 1700 },
    ]);
    expect(warnings).toEqual([]);
    expect(corrections.every((c) => Math.abs(c.residualMm) <= 3)).toBe(true);
    const zone = (id: string) => plano.zones.find((z) => z.id === id)!;
    expect(Math.abs(measuredHeight(zone('a1')) - 2150)).toBeLessThanOrEqual(3);
    expect(Math.abs(measuredHeight(zone('c1')) - 1700)).toBeLessThanOrEqual(3);
    // La columna B, sin tabique ni cota, no se deforma; el tabique de A bajó y el de C subió.
    expect(measuredHeight(zone('b'))).toBe(4000 - T);
    const midA = zone('a1').walls.find((w) => w.id === 'midA')!;
    const midC = zone('a1').walls.find((w) => w.id === 'midC')!;
    expect(midA.from.y).toBeGreaterThan(2200);
    expect(midC.from.y).toBeLessThan(1900);
  });

  it('dos estancias que comparten las mismas líneas con cotas distintas: reparto con aviso, sin colapsar', () => {
    // A y B comparten arriba/abajo (3900 interior); A dice 4300 de alto, B dice 3500: incompatibles.
    const { plano, warnings } = fitPlanToDimensions(twoRooms(), [
      { zoneId: 'a', heightMm: 4300 },
      { zoneId: 'b', heightMm: 3500 },
    ]);
    const rejected = warnings.filter((w) => w.code === 'cota-contradictoria');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    expect(rejected[0]!.message).toMatch(/no es compatible/);
    // Las dos miden lo mismo (comparten líneas): el resultado queda entre ambas cotas.
    const height = measuredHeight(plano.zones[0]!);
    expect(height).toBeGreaterThan(3500);
    expect(height).toBeLessThan(4300);
  });

  it('una cota general que no cuadra con la caja de muros se ignora sin deformar el plano', () => {
    const before = twoRooms();
    // 9 m frente a 6 m medidos: esa cota abarca algo más que los muros (terraza, entrada).
    const { plano, corrections } = fitPlanToDimensions(before, [], { widthMm: 9000 });
    expect(corrections).toEqual([]);
    expect(plano).toEqual(before);
  });
});
