import type { Point } from './schema';
import { localToWorld, type Footprint } from './spatial-properties';

const MIN_SIZE_MM = 50;

/**
 * Redimensiona arrastrando la esquina `corner` (0..3, en el orden del contorno). Por defecto la esquina opuesta se
 * queda fija, así una valla, una puerta o un armario crecen solo por el lado que se arrastra. Con `symmetric` el
 * elemento crece por ambos lados alrededor de su centro (comportamiento con Alt).
 */
export function resizeFromCorner<T extends Footprint>(item: T, corner: number, pointer: Point, symmetric = false): T {
  const angle = item.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = pointer.x - item.x, dy = pointer.y - item.y;
  const local = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  if (symmetric) {
    const centre = { x: item.widthMm / 2, y: item.depthMm / 2 };
    const widthMm = Math.max(MIN_SIZE_MM, Math.abs(local.x - centre.x) * 2), depthMm = Math.max(MIN_SIZE_MM, Math.abs(local.y - centre.y) * 2);
    const origin = localToWorld(item, { x: centre.x - widthMm / 2, y: centre.y - depthMm / 2 });
    return { ...item, ...origin, widthMm, depthMm };
  }
  const corners = [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }];
  const fixed = corners[(corner + 2) % 4]!;
  const widthMm = Math.max(MIN_SIZE_MM, Math.abs(local.x - fixed.x)), depthMm = Math.max(MIN_SIZE_MM, Math.abs(local.y - fixed.y));
  // El nuevo origen local es la esquina mínima del rectángulo que forman la esquina fija y el puntero.
  const originLocal = { x: local.x < fixed.x ? fixed.x - widthMm : fixed.x, y: local.y < fixed.y ? fixed.y - depthMm : fixed.y };
  const origin = localToWorld(item, originLocal);
  return { ...item, ...origin, widthMm, depthMm };
}
