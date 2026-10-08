import type { Furniture, Point } from './schema';
import type { FurnitureVolume } from './furniture-profiles';
import { furnitureSpatial, worldToLocal } from './spatial-properties';

export const isPorch = (item: Pick<Furniture, 'kind'>) => item.kind === 'porche-entrada';
export const isPorchAddon = (part?: FurnitureVolume['part']) => part === 'porch-floor' || part === 'porch-step';
export function porchAccess(item: Furniture) {
  const rise = furnitureSpatial(item).elevationMm, count = Math.max(1, Math.ceil(rise / 170));
  return { rise, count, riser: rise / count, tread: 300, width: Math.min(1200, item.widthMm * .6),
    run: item.porchSteps && rise > 0 ? (count - 1) * 300 : 0 };
}
export const porchPlanDepth = (item: Furniture) => item.depthMm + (isPorch(item) ? porchAccess(item).run : 0);

/** Cuatro apoyos y cubierta, con suelo sólido y peldaños que cambian juntos al editar la cota. */
export function porchVolumes(item: Furniture): FurnitureVolume[] {
  const w = item.widthMm, d = item.depthMm, { elevationMm: e, heightMm: h } = furnitureSpatial(item);
  const parts: FurnitureVolume[] = [{ x: 0, y: 0, widthMm: w, depthMm: d, bottom: Math.min(0, e - 20), top: e,
    color: '#ffffff', materialId: 'polyhaven:stone_tiles_02', part: 'porch-floor' }];
  for (const x of [.08, .92]) for (const y of [.12, .88]) {
    const base = { x: x * w - .05 * w, y: y * d - .075 * d, widthMm: .1 * w, depthMm: .15 * d, color: item.color ?? '#e9e7df' };
    parts.push({ ...base, bottom: e, top: e + h * .045, part: 'post' },
      { ...base, x: x * w - .035 * w, y: y * d - .0525 * d, widthMm: .07 * w, depthMm: .105 * d,
        bottom: e + h * .045, top: e + h * .91, part: 'post' },
      { ...base, bottom: e + h * .91, top: e + h * .94, part: 'post' });
  }
  parts.push({ x: 0, y: 0, widthMm: w, depthMm: d, bottom: e + h * .94, top: e + h,
    color: item.color ?? '#e9e7df' });
  const access = porchAccess(item);
  for (let i = 1; i < access.count && access.run; i++) parts.push({
    x: (w - access.width) / 2, y: d + (access.count - i - 1) * access.tread, widthMm: access.width,
    depthMm: access.tread, bottom: 0, top: access.riser * i, color: '#ffffff',
    materialId: 'polyhaven:stone_tiles_02', part: 'porch-step',
  });
  return parts;
}
export function porchFloorAt(item: Furniture, point: Point): { floorMm: number; riseMm?: number; id: string } | null {
  const p = worldToLocal(item, point), access = porchAccess(item);
  if (p.x >= 0 && p.x <= item.widthMm && p.y >= 0 && p.y <= item.depthMm)
    return { floorMm: access.rise, riseMm: item.porchSteps ? access.riser : undefined, id: item.id };
  if (access.run && p.x >= (item.widthMm - access.width) / 2 && p.x <= (item.widthMm + access.width) / 2
    && p.y > item.depthMm && p.y < item.depthMm + access.run)
    return { floorMm: access.riser * (access.count - 1 - Math.floor((p.y - item.depthMm) / access.tread)), riseMm: access.riser, id: item.id };
  return null;
}
