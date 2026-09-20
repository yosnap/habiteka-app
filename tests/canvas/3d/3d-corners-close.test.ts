import { describe, it, expect } from 'vitest';
import { buildShapeDoc } from '@/canvas/wizard/build-room-doc';
import { docToScene } from '@/canvas/3d/doc-to-scene';

/**
 * Verifica que las cajas 3D de una sala wizard CIERRAN las esquinas: el muro superior
 * (convexo en ambos extremos) se extiende +t en cada lado para cubrir el cuadrado t×t de
 * la esquina con el muro vertical. Antes del fix se recortaba y dejaba huecos.
 */
describe('3D: las esquinas del wizard cierran (sin huecos)', () => {
  it('rectángulo: el muro superior 3D mide W + 2t (cubre ambas esquinas convexas)', () => {
    const W = 5; // m
    const t = 0.15; // m
    const doc = buildShapeDoc({ shape: { shape: 'rect', widthM: W, lengthM: 4 }, ceilingHeightM: 2.5 });
    const scene = docToScene(doc);
    // Cajas cuyo largo (max(size[0],size[2])) es horizontal (largo≈W) y están arriba (z mínimo).
    const horiz = scene.walls.filter((w) => Math.max(w.size[0], w.size[2]) > 3);
    // El muro superior debe medir ≈ W + 2t (extensión de esquina en ambos extremos convexos).
    const longues = horiz.map((w) => Math.max(w.size[0], w.size[2]));
    const maxLong = Math.max(...longues);
    expect(maxLong).toBeGreaterThan(W + t); // cubre esquinas, no recortado a W
    expect(maxLong).toBeLessThan(W + 3 * t); // no se pasa de medida (antes era 1.5t por lado)
  });

  it('L: el muro del recorte mide cutWidth + t (extensión solo en el lado convexo)', () => {
    const cutW = 2.5; // m
    const t = 0.15;
    const doc = buildShapeDoc({
      shape: { shape: 'l', widthM: 6, lengthM: 5, cutWidthM: cutW, cutLengthM: 2.5 },
      ceilingHeightM: 2.5,
    });
    const scene = docToScene(doc);
    // Muro horizontal del recorte: largo ≈ cutWidth (2.5). Con extensión convexa +t → 2.65.
    // El lado cóncavo no se extiende (queda a ras, solapándose con el vertical en el t×t).
    const horiz = scene.walls
      .map((w) => Math.max(w.size[0], w.size[2]))
      .filter((l) => l > 2.3 && l < 2.8);
    expect(horiz.length).toBeGreaterThan(0);
    for (const l of horiz) {
      // 2.5 (natural) ≤ l ≤ 2.5 + t + ε (un solo lado convexo)
      expect(l).toBeGreaterThanOrEqual(cutW - 0.01);
      expect(l).toBeLessThan(cutW + t + 0.05);
    }
  });
});
