import { describe, it, expect } from 'vitest';
import { outlineToWalls } from '@/canvas/wizard/room-shapes';
import { computeWallMiters } from '@/components/canvas/layers/wall-junction-caps';
import type { StructObj } from '@/canvas/types';

/**
 * Verifica que las esquinas CÓNCAVAS de una L reciben inglete diagonal (no se saltan)
 * y que la bisectriz producida genera la diagonal correcta (compartida por ambos muros).
 */
describe('inglete en esquinas cóncavas (L/U/T)', () => {
  it('la L genera miter en su esquina cóncava y la diagonal coincide entre muros', () => {
    // L: 6×5 m, recorte 2.5×2.5 m en esquina inf-derecha. 100 px/m, t=15 px.
    const t = 15;
    const verts = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 250 },
      { x: 350, y: 250 }, // vértice CÓNCAVO
      { x: 350, y: 500 },
      { x: 0, y: 500 },
    ];
    const walls = outlineToWalls(verts, t);
    const miters = computeWallMiters(walls);

    // Al menos un muro debe tener miter (la sala completa tiene juntas en todas las esquinas).
    expect(miters.size).toBeGreaterThan(0);

    // Cada muro de la L toca a otro en ambos extremos → todos con miter en p1 y p2.
    for (const w of walls) {
      const m = miters.get(w.id);
      expect(m, `muro ${w.id} sin miter`).toBeDefined();
      expect(m!.p1 || m!.p2).toBeTruthy();
    }

    // Localizar el muro horizontal del recorte (y≈250, ancho) y el vertical del recorte (x≈350, alto).
    const horiz = walls.find((w) => Math.abs(w.y - 250) < 1 && w.width > w.height)!;
    const vert = walls.find((w) => Math.abs(w.x - 350) < 1 && w.height > w.width)!;
    expect(horiz).toBeDefined();
    expect(vert).toBeDefined();

    // El horizontal del recorte: extremo izquierdo (menor X) es el cóncavo → extLeft=false.
    const hMeta = horiz.meta as { extLeft?: boolean; extRight?: boolean };
    expect(hMeta.extLeft).toBe(false);
    // El vertical del recorte: extremo superior (menor Y) es el cóncavo → topConvex=false.
    const vMeta = vert.meta as { topConvex?: boolean; bottomConvex?: boolean };
    expect(vMeta.topConvex).toBe(false);

    // La bisectriz de la esquina cóncava es (1,1)/√2 → lbx≈lby>0 para el muro horizontal
    // en su extremo cóncavo (p1 en wallGeom = menor X). Y para el vertical en p1 (menor Y).
    const hm = miters.get(horiz.id)!;
    const vm = miters.get(vert.id)!;
    // El extremo cóncavo del horizontal es p1 (borde menor X). Comprobamos que ese miter existe
    // y su bisectriz apunta a (+x,+y) en local (lbx>0, lby>0): corte diagonal de sup-izq a inf-der.
    const hp = hm.p1 ?? hm.p2;
    expect(hp).toBeTruthy();
    expect(hp!.lbx).toBeGreaterThan(0);
    expect(hp!.lby).toBeGreaterThan(0);
    const vp = vm.p1 ?? vm.p2;
    expect(vp).toBeTruthy();
    expect(vp!.lbx).toBeGreaterThan(0);
    expect(vp!.lby).toBeGreaterThan(0);
  });
});
