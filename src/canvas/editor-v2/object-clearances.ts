import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { localToWorld, type Footprint } from '@/lib/editor-document/spatial-properties';
import { wallPoints } from '@/lib/editor-document/geometry';

/** Rays start at footprint edge midpoints and stop at the closest wall face. */
export function objectClearances(doc: EditorDocument, item: Footprint): { from: Point; to: Point }[] {
  const angle = item.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return [[item.widthMm / 2, 0, 0, -1], [item.widthMm, item.depthMm / 2, 1, 0],
    [item.widthMm / 2, item.depthMm, 0, 1], [0, item.depthMm / 2, -1, 0]].flatMap(([x, y, dx, dy]) => {
    const from = localToWorld(item, { x: x!, y: y! }), direction = { x: dx! * cos - dy! * sin, y: dx! * sin + dy! * cos };
    let nearest = Infinity;
    for (const w of doc.walls) {
      const [a, b] = wallPoints(doc, w), length = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
      const denominator = direction.x * uy - direction.y * ux;
      if (Math.abs(denominator) < .000001) continue;
      for (const side of [-1, 1]) {
        const px = a.x - uy * w.thicknessMm / 2 * side - from.x, py = a.y + ux * w.thicknessMm / 2 * side - from.y;
        const t = (px * uy - py * ux) / denominator;
        const along = (px * direction.y - py * direction.x) / denominator;
        if (t >= 0 && along >= 0 && along <= length) nearest = Math.min(nearest, t);
      }
    }
    return Number.isFinite(nearest) ? [{ from, to: { x: from.x + direction.x * nearest, y: from.y + direction.y * nearest } }] : [];
  });
}
