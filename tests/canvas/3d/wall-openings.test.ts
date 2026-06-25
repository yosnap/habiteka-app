import { describe, it, expect } from 'vitest';
import {
  wallAxis,
  associateOpening,
  openingSpanLocal,
  splitWallWithOpenings,
  SILL_M,
  LINTEL_GAP_M,
} from '@/canvas/3d/wall-openings';
import { DEFAULT_CEILING_M } from '@/canvas/scale';
import type { StructObj } from '@/canvas/types';

function obj(partial: Partial<StructObj> & Pick<StructObj, 'id' | 'kind'>): StructObj {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, ...partial };
}

const PPM = 100; // px por metro
const CENTER: [number, number] = [0, 0]; // centro del plano en px (no afecta a las pruebas relativas)

describe('wall-openings: wallAxis (eje longitudinal por lado mayor, no por rotation)', () => {
  it('muro horizontal (w≥h, rot 0): eje = X', () => {
    const a = wallAxis(obj({ id: 'w', kind: 'wall', width: 500, height: 15 }));
    expect(a.L).toBe(500);
    expect(a.t).toBe(15);
    expect(a.u[0]).toBeCloseTo(1, 6);
    expect(a.u[1]).toBeCloseTo(0, 6);
  });

  it('muro vertical del seed (h>w, rot 0 = w-left): eje = Y, NO derivado de rotation', () => {
    const a = wallAxis(obj({ id: 'w', kind: 'wall', width: 15, height: 360 }));
    expect(a.L).toBe(360);
    expect(a.t).toBe(15);
    expect(a.u[0]).toBeCloseTo(0, 6);
    expect(a.u[1]).toBeCloseTo(1, 6);
  });

  it('muro de Draw Walls rotado 90° (w=longitud, rot 90): eje gira con rotation', () => {
    const a = wallAxis(obj({ id: 'w', kind: 'wall', width: 500, height: 15, rotation: 90 }));
    expect(a.L).toBe(500);
    expect(a.u[0]).toBeCloseTo(0, 6);
    expect(a.u[1]).toBeCloseTo(1, 6);
  });
});

describe('wall-openings: openingSpanLocal (proyección de las 4 esquinas sobre el eje)', () => {
  it('ventana centrada sobre un muro horizontal proyecta su ancho a lo largo del eje', () => {
    const wall = obj({ id: 'w', kind: 'wall', x: 200, y: 120, width: 520, height: 15 });
    const win = obj({ id: 'win', kind: 'window', x: 540, y: 111, width: 140, height: 18 });
    const span = openingSpanLocal(win, wall, wallAxis(wall));
    // u medido desde el extremo 0 del muro (x=200): la ventana va de 540 a 680 → [340, 480].
    expect(span[0]).toBeCloseTo(340, 0);
    expect(span[1]).toBeCloseTo(480, 0);
  });

  it('clampa a [0, L] si el hueco sobresale del muro', () => {
    const wall = obj({ id: 'w', kind: 'wall', x: 0, y: 0, width: 200, height: 15 });
    const win = obj({ id: 'win', kind: 'window', x: 150, y: 0, width: 120, height: 15 });
    const span = openingSpanLocal(win, wall, wallAxis(wall));
    expect(span[0]).toBeGreaterThanOrEqual(0);
    expect(span[1]).toBeLessThanOrEqual(200);
    expect(span[1]).toBeCloseTo(200, 0);
  });
});

describe('wall-openings: associateOpening (por distancia perpendicular, no por área)', () => {
  // Muros del salón de ejemplo (examples.ts).
  const wTop = obj({ id: 'w-top', kind: 'wall', x: 200, y: 120, width: 520, height: 15 });
  const wLeft = obj({ id: 'w-left', kind: 'wall', x: 200, y: 120, width: 15, height: 360 });
  const wRight = obj({ id: 'w-right', kind: 'wall', x: 705, y: 120, width: 15, height: 360 });

  it('la ventana del salón (solapa solo ~9px) se asocia a w-top', () => {
    const win = obj({ id: 'win-1', kind: 'window', x: 540, y: 111, width: 140, height: 18 });
    expect(associateOpening(win, [wTop, wLeft, wRight])?.id).toBe('w-top');
  });

  it('la puerta del salón se asocia a w-left', () => {
    const door = obj({ id: 'door-1', kind: 'door', x: 209, y: 290, width: 18, height: 90 });
    expect(associateOpening(door, [wTop, wLeft, wRight])?.id).toBe('w-left');
  });
});

describe('wall-openings: splitWallWithOpenings', () => {
  const wall = obj({ id: 'w', kind: 'wall', x: 0, y: 0, width: 600, height: 15 });

  it('muro sin huecos → 1 sola caja de altura completa', () => {
    const { boxes, panes } = splitWallWithOpenings(wall, [], DEFAULT_CEILING_M, CENTER, PPM);
    expect(boxes).toHaveLength(1);
    expect(panes).toHaveLength(0);
    expect(boxes[0]?.size[1]).toBeCloseTo(DEFAULT_CEILING_M, 6); // altura completa
  });

  it('ventana centrada → izq + dcha + dintel + alféizar + cristal + carpintería (marco+cruz)', () => {
    const win = obj({ id: 'win', kind: 'window', x: 250, y: 0, width: 100, height: 15 });
    const { boxes, panes, frames } = splitWallWithOpenings(wall, [win], DEFAULT_CEILING_M, CENTER, PPM);
    const ids = boxes.map((b) => b.id);
    expect(ids).toContain('w:seg0'); // tramo izquierdo
    expect(ids).toContain('w:segEnd'); // tramo derecho
    expect(ids).toContain('win:lintel');
    expect(ids).toContain('win:sill');
    expect(panes).toHaveLength(1);
    expect(panes[0]?.id).toBe('win:glass');
    // El cristal va del alféizar (0.9) al dintel (techo-0.3).
    const vTop = DEFAULT_CEILING_M - LINTEL_GAP_M;
    expect(panes[0]?.center[1]).toBeCloseTo((SILL_M + vTop) / 2, 4);
    expect(panes[0]?.size[1]).toBeCloseTo(vTop - SILL_M, 4);
    // Carpintería: 4 perfiles de marco + montante + peinazo, todos material 'frame'.
    const frameIds = frames.map((f) => f.id);
    expect(frameIds).toEqual(
      expect.arrayContaining([
        'win:f-bottom',
        'win:f-top',
        'win:f-left',
        'win:f-right',
        'win:f-mullion',
        'win:f-transom',
      ]),
    );
    expect(frames.every((f) => f.material === 'frame')).toBe(true);
  });

  it('puerta centrada → izq + dcha + dintel, SIN alféizar, 0 cristales, hoja de madera', () => {
    const door = obj({ id: 'd', kind: 'door', x: 250, y: 0, width: 100, height: 15 });
    const { boxes, panes, frames } = splitWallWithOpenings(wall, [door], DEFAULT_CEILING_M, CENTER, PPM);
    const ids = boxes.map((b) => b.id);
    expect(ids).toContain('d:lintel');
    expect(ids).not.toContain('d:sill'); // puerta llega al suelo
    expect(panes).toHaveLength(0);
    // Hoja de puerta (madera) que rellena el vano.
    expect(frames).toHaveLength(1);
    expect(frames[0]?.id).toBe('d:leaf');
    expect(frames[0]?.material).toBe('door');
  });

  it('hueco pegado al extremo izquierdo → sin tramo izquierdo', () => {
    const win = obj({ id: 'win', kind: 'window', x: 0, y: 0, width: 100, height: 15 });
    const { boxes } = splitWallWithOpenings(wall, [win], DEFAULT_CEILING_M, CENTER, PPM);
    expect(boxes.map((b) => b.id)).not.toContain('w:seg0');
    expect(boxes.map((b) => b.id)).toContain('w:segEnd');
  });

  it('todos los ids resultantes son únicos (no rompe keys de React)', () => {
    const w1 = obj({ id: 'win1', kind: 'window', x: 100, y: 0, width: 80, height: 15 });
    const w2 = obj({ id: 'win2', kind: 'window', x: 400, y: 0, width: 80, height: 15 });
    const { boxes, panes, frames } = splitWallWithOpenings(wall, [w1, w2], DEFAULT_CEILING_M, CENTER, PPM);
    const allIds = [...boxes.map((b) => b.id), ...panes.map((p) => p.id), ...frames.map((f) => f.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('dos ventanas en el mismo muro → tramos entre ellas (orden por u)', () => {
    const w1 = obj({ id: 'win1', kind: 'window', x: 100, y: 0, width: 80, height: 15 });
    const w2 = obj({ id: 'win2', kind: 'window', x: 400, y: 0, width: 80, height: 15 });
    const { boxes, panes } = splitWallWithOpenings(wall, [w1, w2], DEFAULT_CEILING_M, CENTER, PPM);
    expect(panes).toHaveLength(2);
    // Tramo izquierdo, tramo central entre huecos, tramo final.
    expect(boxes.map((b) => b.id)).toContain('w:seg0');
    expect(boxes.map((b) => b.id)).toContain('w:seg1');
    expect(boxes.map((b) => b.id)).toContain('w:segEnd');
  });
});
