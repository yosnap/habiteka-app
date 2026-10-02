import type { EditorDocument } from '@/lib/editor-document/schema';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
const cache = new WeakMap<EditorDocument, { minX: number; maxX: number; minZ: number; maxZ: number; heightM: number }>();
/** Una medición por instantánea; incluye plantas y tejado para no cortarlos durante el vuelo. */
export function videoBuildingBounds(doc: EditorDocument, regions: ZoneMaskRegions = []) {
  const saved = regions.length ? null : cache.get(doc); if (saved) return saved;
  const levels = buildingDocuments(doc), points = regions.length ? regions.flat() : levels.flatMap(level => level.document.vertices);
  const roofs = levels.flatMap(level => exteriorRoofGeometry(level.document).map(part => ({ part, elevationM: level.elevationMm / 1000 })));
  const xs = points.map(p => p.x / 1000), zs = points.map(p => p.y / 1000);
  if (!regions.length) for (const { part } of roofs) for (let i = 0; i < part.positions.length; i += 3) { xs.push(part.positions[i]!); zs.push(part.positions[i + 2]!); }
  const value = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
    heightM: Math.max(2.7, ...levels.flatMap(level => level.document.walls.filter(w => !w.hidden)
      .map(w => (level.elevationMm + (w.baseElevationMm ?? 0) + (w.heightMm ?? 2700)) / 1000)),
    ...roofs.map(({ part, elevationM }) => part.peakM + elevationM)) };
  if (!regions.length) cache.set(doc, value); return value;
}
