import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Column, Furniture, Ramp, Stair, Point } from '@/lib/editor-document/schema';
import { alignPoint, alignPoints, footprintAnchors } from '@/canvas/editor-v2/magnetic-alignment';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { wallPath } from '@/lib/editor-document/wall-path';
export function snapSpatialDrag(store: EditorStore, item: Furniture | Stair | Ramp | Column, scale: number, previewRotation?: number) {
  const state = store.getState(), snapped = snapObject(state.document, item, scale, state.snap, { preserveRotation: true, orientToWall: true, preferredRotation: previewRotation });
  const points = footprintAnchors(snapped), guides = alignPoints(state.document, points, 100, state.snap, [item.id]).guides;
  if (state.snap) for (const wall of state.document.walls.filter((w) => !w.hidden)) {
    const path = wallPath(state.document, wall);
    if (points.some((p) => Math.abs(Math.hypot(p.x - path.at(path.project(p)).x, p.y - path.at(path.project(p)).y) - wall.thicknessMm / 2) < 1)) {
      const p = path.at(0), q = path.at(1), n = path.tangent(.5);
      const side = ((snapped.x - p.x) * -n.y + (snapped.y - p.y) * n.x) < 0 ? -1 : 1;
      const offset = { x: -n.y * wall.thicknessMm / 2 * side, y: n.x * wall.thicknessMm / 2 * side };
      guides.push({ from: { x: p.x + offset.x, y: p.y + offset.y }, to: { x: q.x + offset.x, y: q.y + offset.y } });
    }
  }
  state.setMagneticGuides(guides); return snapped;
}
export function snapPointDrag(store: EditorStore, point: Point, scale: number, exclude: string[] = []) {
  const state = store.getState(), result = alignPoint(state.document, point, scale, state.snap, exclude);
  state.setMagneticGuides(result.guides); return result.point;
}
