import { describe, expect, it } from 'vitest';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { applyReviewedDoors, applyReviewedWalls, reviewedWallOverrides } from '@/lib/plan-review-geometry';

function fixture() {
  const raw: RawSketch = { anchoMetros: 4, altoMetros: 3, escalaFiable: true,
    muros: [{ x1: 0, y1: 0, x2: 1, y2: 0 }, { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 1, y1: 1, x2: 0, y2: 1 }, { x1: 0, y1: 1, x2: 0, y2: 0 }],
    habitaciones: [{ nombre: 'Sala', poligono: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }],
    aberturas: [{ tipo: 'puerta', muro: 0, posicion: .5, anchoSobreMuro: .2 }], mobiliario: [] };
  return { raw, result: buildPlanImport(raw) };
}
describe('correcciones de geometría persistibles', () => {
  it('reconstruye exactamente el muro y ancho de puerta revisados desde la extracción guardada', () => {
    const { raw, result } = fixture(), wall = result.plano.zones[0]!.walls[0]!;
    const door = result.plano.zones.flatMap(zone => zone.apertures)[0]!;
    const moved = applyReviewedWalls(result.plano, [{ wallId: wall.id, from: wall.from,
      to: { ...wall.to, x: wall.to.x + 200 }, thicknessMm: 180 }]);
    const doorOverrides = [{ apertureId: door.id, widthMm: 1000, position: .4, hinge: 'right' as const }];
    const edited = applyReviewedDoors(moved, doorOverrides);
    const restored = buildPlanImport(raw, { wallOverrides: reviewedWallOverrides(result.plano, moved), doorOverrides });
    expect(restored.plano).toEqual(edited);
    const joined = restored.plano.zones[0]!.walls.find(item => item.id !== wall.id && item.from.x === wall.to.x + 200);
    expect(joined).toBeDefined();
    expect(restored.plano.zones[0]!.outline).toContainEqual({ ...wall.to, x: wall.to.x + 200 });
  });
  it('rechaza ancho imposible, posición inválida, puerta ajena y duplicados', () => {
    const { result } = fixture(), door = result.plano.zones.flatMap(zone => zone.apertures)[0]!;
    for (const patch of [{ widthMm: 99999 }, { widthMm: NaN }, { position: -1 }])
      expect(() => applyReviewedDoors(result.plano, [{ apertureId: door.id, ...patch }])).toThrow();
    expect(() => applyReviewedDoors(result.plano, [{ apertureId: 'ajena', widthMm: 800 }])).toThrow(/no existe/);
    expect(() => applyReviewedDoors(result.plano, [{ apertureId: door.id }, { apertureId: door.id }])).toThrow(/repetida/);
  });
  it('recoloca el centro para que un hueco ampliado no salga del muro', () => {
    const { result } = fixture(), door = result.plano.zones.flatMap(zone => zone.apertures)[0]!;
    const edited = applyReviewedDoors(result.plano, [{ apertureId: door.id, widthMm: 1000, position: 0 }]);
    expect(edited.zones.flatMap(zone => zone.apertures)[0]!.position).toBeGreaterThan(0);
  });
  it('rechaza esquinas contradictorias y muros colapsados', () => {
    const { result } = fixture(), wall = result.plano.zones[0]!.walls[0]!;
    expect(() => applyReviewedWalls(result.plano, [{ wallId: wall.id, from: wall.from, to: wall.from, thicknessMm: 100 }])).toThrow(/5 cm/);
    expect(() => applyReviewedWalls(result.plano, [{ wallId: wall.id, from: wall.from, to: wall.to, thicknessMm: 0 }])).toThrow(/grosor/);
  });
});
