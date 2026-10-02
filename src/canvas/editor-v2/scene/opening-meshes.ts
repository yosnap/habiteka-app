import type { EditorDocument, Opening } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { meters, type SceneBox } from './types';
import { wallPath } from '@/lib/editor-document/wall-path';
import { curvedOpeningMeshes } from './curved-opening-meshes';
import { WINDOW_GLASS_COLOR, WINDOW_SEAL_COLOR, windowSealWidth } from './window-appearance';

export function openingMeshes(doc: EditorDocument, opening: Opening): SceneBox[] {
  if (opening.kind === 'hueco') return [];
  const wall = doc.walls.find((w) => w.id === opening.wallId)!;
  if (wall.curveHeightMm) return curvedOpeningMeshes(doc, wall, opening);
  const path = wallPath(doc, wall), a = path.at(opening.position), direction = path.tangent(opening.position), angle = Math.atan2(direction.y, direction.x);
  const center = 0, p = openingConstruction(opening), width = opening.widthMm;
  const boxes: SceneBox[] = [], frame = Math.min(45, width / 8, p.heightMm / 8), depth = wall.thicknessMm + 20;
  const add = (role: SceneBox['role'], x: number, y: number, z: number, w: number, h: number, d: number, rotation = angle) => {
    boxes.push({ id: `${opening.id}:${boxes.length}`, sourceEntityId: opening.id, role,
      position: [meters(a.x + Math.cos(angle) * (center + x) - Math.sin(angle) * z), meters(p.elevationMm + y),
        meters(a.y + Math.sin(angle) * (center + x) + Math.cos(angle) * z)],
      size: [meters(w), meters(h), meters(d)], rotation: -rotation,
      color: role === 'glass' ? WINDOW_GLASS_COLOR : role === 'seal' ? WINDOW_SEAL_COLOR
        : role === 'leaf' ? opening.colors?.leaf ?? '#bb956c' : opening.colors?.frame ?? '#f4f1e9' });
  };
  add('frame', -width / 2 + frame / 2, p.heightMm / 2, 0, frame, p.heightMm, depth);
  add('frame', width / 2 - frame / 2, p.heightMm / 2, 0, frame, p.heightMm, depth);
  add('frame', 0, p.heightMm - frame / 2, 0, width, frame, depth);
  if (opening.kind === 'ventana') {
    add('frame', 0, frame / 2, 0, width, frame, depth);
    add('frame', 0, p.heightMm / 2, 0, frame, p.heightMm - 2 * frame, depth * .6);
    add('glass', 0, p.heightMm / 2, 0, width - 2 * frame, p.heightMm - 2 * frame, 8);
    const seal = windowSealWidth(frame), innerWidth = width - 2 * frame;
    for (const side of [-1, 1]) {
      const face = side * (depth / 2 + 2);
      add('seal', -innerWidth / 2 + seal / 2, p.heightMm / 2, face, seal, p.heightMm - 2 * frame, 4);
      add('seal', innerWidth / 2 - seal / 2, p.heightMm / 2, face, seal, p.heightMm - 2 * frame, 4);
      add('seal', 0, p.heightMm - frame + seal / 2, face, innerWidth, seal, 4);
      add('seal', 0, frame - seal / 2, face, innerWidth, seal, 4);
    }
  } else {
    const leafWidth = width - 2 * frame, hinge = p.hinge === 'left' ? -1 : 1;
    const delta = p.hinge === 'left' ? (p.swing === 'left' ? 1 : -1) * p.openAngleDeg * Math.PI / 180
      : Math.PI - (p.swing === 'left' ? 1 : -1) * p.openAngleDeg * Math.PI / 180;
    add('leaf', hinge * leafWidth / 2 + Math.cos(delta) * leafWidth / 2, (p.heightMm - frame) / 2,
      Math.sin(delta) * leafWidth / 2, leafWidth, p.heightMm - frame, 38, angle + delta);
  }
  return boxes;
}
