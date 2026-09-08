import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { distance } from '@/lib/editor-document/geometry';
import { splitWall } from '@/lib/editor-document/wall-commands';
import { addWallPath, newId } from './editing-operations';
import { applyWallExtension, type WallExtension } from './wall-extension';
import { wallPath } from '@/lib/editor-document/wall-path';

export type WallDrawState = { anchor: Point | null; preview: Point | null };
export const idleWallDraw = (): WallDrawState => ({ anchor: null, preview: null });
export function moveWallDraw(state: WallDrawState, point: Point): WallDrawState {
  return state.anchor ? { ...state, preview: point } : state;
}
/** Split endpoint hosts on a clone; validation rejects crossings and openings atomically. */
export function addWallSegment(doc: EditorDocument, from: Point, to: Point): EditorDocument {
  const next = structuredClone(doc);
  for (const point of [from, to]) {
    if (next.vertices.some((v) => distance(v, point) < .01)) continue;
    for (const wall of [...next.walls]) {
      const path = wallPath(next, wall), t = path.project(point);
      if (t <= 0 || t >= 1) continue;
      if (distance(point, path.at(t)) < .01) {
        splitWall(next, wall.id, t, newId(), newId());
        break;
      }
    }
  }
  return addWallPath(next, [from, to]);
}
export function clickWallDraw(state: WallDrawState, point: Point, doc: EditorDocument, extension?: WallExtension): { state: WallDrawState; document?: EditorDocument } {
  if (!state.anchor) return { state: { anchor: point, preview: point } };
  if (distance(state.anchor, point) < 50) return { state };
  const document = addWallSegment(extension ? applyWallExtension(doc, extension) : doc, state.anchor, point);
  const closes = extension || doc.vertices.some((v) => distance(v, point) < .01);
  return { state: closes ? idleWallDraw() : { anchor: point, preview: point }, document };
}
