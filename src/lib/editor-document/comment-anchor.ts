import type { EditorDocument, ElementComment } from './schema';
import { wallPath } from './wall-path';
import { localToWorld, furnitureSpatial } from './spatial-properties';
import { openingConstruction, wallConstruction } from './construction-properties';

export function commentAnchor(doc: EditorDocument, comment: ElementComment) {
  const wall = doc.walls.find((w) => w.id === comment.targetEntityId);
  if (wall) return { ...wallPath(doc, wall).at(comment.anchor.x), elevationMm: wallConstruction(wall).heightMm };
  const opening = doc.openings.find((o) => o.id === comment.targetEntityId);
  if (opening) {
    const host = doc.walls.find((w) => w.id === opening.wallId)!;
    const props = openingConstruction(opening);
    return { ...wallPath(doc, host).at(opening.position), elevationMm: props.elevationMm + props.heightMm };
  }
  const object = doc.furniture.find((f) => f.id === comment.targetEntityId) ?? doc.stairs?.find((s) => s.id === comment.targetEntityId);
  if (!object) return null;
  const props = 'stepCount' in object ? object : furnitureSpatial(object);
  return { ...localToWorld(object, { x: comment.anchor.x * object.widthMm, y: comment.anchor.y * object.depthMm }),
    elevationMm: props.elevationMm + props.heightMm };
}
