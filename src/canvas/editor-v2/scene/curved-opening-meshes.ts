import type { EditorDocument, Opening, Wall } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { meters, type SceneBox } from './types';

/** Frames and glazing follow the host arc; a hinged door leaf remains rigid. */
export function curvedOpeningMeshes(doc: EditorDocument, wall: Wall, opening: Opening): SceneBox[] {
  const path = wallPath(doc, wall), props = openingConstruction(opening), boxes: SceneBox[] = [];
  const frame = Math.min(45, opening.widthMm / 8, props.heightMm / 8), from = opening.position - opening.widthMm / path.length / 2;
  const to = opening.position + opening.widthMm / path.length / 2, depth = wall.thicknessMm + 20;
  const add = (role: SceneBox['role'], x: number, z: number, y: number, width: number, height: number, thickness: number, angle: number) => {
    boxes.push({ id: `${opening.id}:${boxes.length}`, sourceEntityId: opening.id, role,
      position: [meters(x), meters(props.elevationMm + y), meters(z)], size: [meters(width), meters(height), meters(thickness)], rotation: -angle,
      color: role === 'glass' ? '#b3d9e4' : role === 'leaf' ? opening.colors?.leaf ?? '#bb956c' : opening.colors?.frame ?? '#f4f1e9' });
  };
  const band = (start: number, end: number, y: number, height: number, thickness: number, role: SceneBox['role'] = 'frame') => {
    const points = path.samples(start, end);
    points.slice(1).forEach((b, i) => {
      const a = points[i]!;
      add(role, (a.x + b.x) / 2, (a.y + b.y) / 2, y, Math.hypot(b.x - a.x, b.y - a.y) + .2, height, thickness, Math.atan2(b.y - a.y, b.x - a.x));
    });
  };
  const innerFrom = from + frame / path.length, innerTo = to - frame / path.length;
  band(from, innerFrom, props.heightMm / 2, props.heightMm, depth);
  band(innerTo, to, props.heightMm / 2, props.heightMm, depth);
  band(from, to, props.heightMm - frame / 2, frame, depth);
  if (opening.kind === 'ventana') {
    band(from, to, frame / 2, frame, depth);
    band(opening.position - frame / path.length / 2, opening.position + frame / path.length / 2, props.heightMm / 2, props.heightMm - frame * 2, depth * .6);
    band(innerFrom, innerTo, props.heightMm / 2, props.heightMm - frame * 2, 8, 'glass');
  } else {
    const left = path.at(innerFrom), right = path.at(innerTo), hinge = props.hinge === 'left' ? left : right, end = props.hinge === 'left' ? right : left;
    const width = Math.hypot(end.x - hinge.x, end.y - hinge.y);
    const delta = (props.swing === 'left' ? 1 : -1) * (props.hinge === 'left' ? 1 : -1) * props.openAngleDeg * Math.PI / 180;
    const angle = Math.atan2(end.y - hinge.y, end.x - hinge.x) + delta;
    add('leaf', hinge.x + Math.cos(angle) * width / 2, hinge.y + Math.sin(angle) * width / 2,
      (props.heightMm - frame) / 2, width, props.heightMm - frame, 38, angle);
  }
  return boxes;
}
