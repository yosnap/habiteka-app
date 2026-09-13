import type { SketchWall } from '@/server/ai/sketch/sketch-types';

/** Marcos de lámina: líneas casi completas pegadas al borde, con plano interior. */
export function filterSheetFrame(walls: SketchWall[]): SketchWall[] {
  const margin = 0.04;
  const horizontal = (w: SketchWall) =>
    Math.abs(w.y1 - w.y2) < 0.002 && Math.abs(w.x2 - w.x1) > 0.9 &&
    (w.y1 < margin || w.y1 > 1 - margin);
  const vertical = (w: SketchWall) =>
    Math.abs(w.x1 - w.x2) < 0.002 && Math.abs(w.y2 - w.y1) > 0.9 &&
    (w.x1 < margin || w.x1 > 1 - margin);
  const isFrame = (w: SketchWall) => horizontal(w) || vertical(w);
  const interior = walls.filter(w => !isFrame(w));
  // No eliminar el perímetro de una habitación que llena la imagen. Exigir
  // un marco repetido por ambos ejes y otra estructura separada del margen.
  const detached = interior.filter(w => [w.x1, w.x2, w.y1, w.y2]
    .every(coordinate => coordinate > margin * 2 && coordinate < 1 - margin * 2));
  if (walls.filter(horizontal).length < 3 || walls.filter(vertical).length < 3 || detached.length < 4) {
    return walls;
  }
  return interior;
}
