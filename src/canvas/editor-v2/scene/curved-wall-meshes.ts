import type { EditorDocument, Wall } from '@/lib/editor-document/schema';
import { wallPath, wallStrip } from '@/lib/editor-document/wall-path';
import { wallConstruction, openingConstruction } from '@/lib/editor-document/construction-properties';
import { WALL_PLAN_COLOR } from '@/lib/editor-document/wall-appearance';
import { meters, materialColor, type ScenePolygon } from './types';

/** A continuous annular strip, with opening intervals removed by height band. */
export function curvedWallMeshes(doc: EditorDocument, wall: Wall): ScenePolygon[] {
  if (!wall.curveHeightMm) return [];
  const length = wallPath(doc, wall).length, construction = wallConstruction(wall), base = wall.baseElevationMm ?? 0,
    height = construction.heightMm, ceiling = base + height;
  const openings = doc.openings.filter((o) => o.wallId === wall.id).map((o) => ({
    from: o.position - o.widthMm / length / 2, to: o.position + o.widthMm / length / 2,
    bottom: openingConstruction(o).elevationMm, top: openingConstruction(o).elevationMm + openingConstruction(o).heightMm,
  })).sort((a, b) => a.from - b.from);
  const polygons: ScenePolygon[] = [];
  const add = (from: number, to: number, bottom: number, top: number) => {
    if (to - from < 1e-8 || top - bottom < .001) return;
    const points = wallStrip(doc, wall, from, to), count = points.length / 2;
    polygons.push({ id: `${wall.id}:curve:${polygons.length}`, sourceEntityId: wall.id, role: 'wall',
      points: points.map((p) => ({ x: meters(p.x), y: meters(p.y) })), elevation: meters(bottom), height: meters(top - bottom),
      color: '#d8d5ce', topColor: top === ceiling ? WALL_PLAN_COLOR : '#d8d5ce',
      edgeFinishes: points.map((_, i) => ({ sourceEntityId: wall.id,
        materialId: i === count - 1 || i === points.length - 1 ? undefined : i < count ? construction.materials.left : construction.materials.right,
        offsetX: meters(length * (from + (to - from) * (i < count ? i : points.length - 1 - i) / (count - 1))),
        // Both faces share a continuous arc coordinate; the outer ring runs backwards.
        spanX: meters(length * (to - from) / (count - 1)) * (i < count ? 1 : -1),
        color: i === count - 1 || i === points.length - 1 ? '#d8d5ce'
        : i < count ? wall.colors?.left ?? materialColor(construction.materials.left) : wall.colors?.right ?? materialColor(construction.materials.right) })),
    });
  };
  let cursor = 0;
  for (const o of openings) { add(cursor, o.from, base, ceiling); add(o.from, o.to, base, Math.min(ceiling, Math.max(base, o.bottom)));
    add(o.from, o.to, Math.max(base, o.top), ceiling); cursor = o.to; }
  add(cursor, 1, base, ceiling);
  return polygons;
}
