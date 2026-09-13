import type { EditorDocument, Wall } from '@/lib/editor-document/schema';
import { wallConstruction, openingConstruction } from '@/lib/editor-document/construction-properties';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { wallJunctions } from '../wall-junctions';
import { materialColor, meters, type SceneBox, type ScenePolygon } from './types';
import { WALL_PLAN_COLOR } from '@/lib/editor-document/wall-appearance';
import { junctionFinishes } from './junction-finishes';

export function wallMeshes(doc: EditorDocument, wall: Wall): SceneBox[] {
  const [a, b] = wallPoints(doc, wall), length = distance(a, b), angle = Math.atan2(b.y - a.y, b.x - a.x);
  const construction = wallConstruction(wall), height = construction.heightMm;
  const openings = doc.openings.filter((o) => o.wallId === wall.id).map((o) => ({
    from: o.position * length - o.widthMm / 2, to: o.position * length + o.widthMm / 2,
    bottom: openingConstruction(o).elevationMm, top: openingConstruction(o).elevationMm + openingConstruction(o).heightMm,
  })).sort((x, y) => x.from - y.from);
  const boxes: SceneBox[] = [];
  const add = (from: number, to: number, bottom: number, top: number) => {
    if (to - from < .001 || top - bottom < .001) return;
    const center = (from + to) / 2;
    boxes.push({ id: `${wall.id}:${boxes.length}`, sourceEntityId: wall.id, role: 'wall',
      position: [meters(a.x + Math.cos(angle) * center), meters((bottom + top) / 2), meters(a.y + Math.sin(angle) * center)],
      size: [meters(to - from), meters(top - bottom), meters(wall.thicknessMm)], rotation: -angle,
      // Caps are structural, not either painted face. Left paint must not leak outside.
      color: '#d8d5ce',
      sideMaterials: [construction.materials.left, construction.materials.right], textureOffset: [meters(from), meters(bottom)],
      topColor: top === height ? WALL_PLAN_COLOR : undefined,
      sideColors: [wall.colors?.left ?? materialColor(construction.materials.left), wall.colors?.right ?? materialColor(construction.materials.right)] });
  };
  let cursor = 0;
  for (const opening of openings) {
    add(cursor, opening.from, 0, height);
    add(opening.from, opening.to, 0, opening.bottom);
    add(opening.from, opening.to, opening.top, height);
    cursor = opening.to;
  }
  add(cursor, length, 0, height);
  return boxes;
}

/** Height bands avoid carrying a low wall's corner shape up to its taller neighbor. */
export function junctionMeshes(doc: EditorDocument): ScenePolygon[] {
  return doc.vertices.flatMap((vertex) => {
    const incident = doc.walls.filter((w) => w.startVertexId === vertex.id || w.endVertexId === vertex.id);
    if (incident.length < 2) return [];
    const levels = [...new Set([0, ...incident.map((w) => wallConstruction(w).heightMm),
      ...doc.openings.filter((o) => incident.some((w) => w.id === o.wallId)).flatMap((o) => {
        const p = openingConstruction(o); return [p.elevationMm, p.elevationMm + p.heightMm];
      })])].sort((a, b) => a - b);
    return levels.slice(1).flatMap((top, index) => {
      const bottom = levels[index]!, middle = (bottom + top) / 2;
      const walls = incident.filter((wall) => wallConstruction(wall).heightMm >= top && !doc.openings.some((o) => {
        if (o.wallId !== wall.id) return false;
        const p = openingConstruction(o), length = distance(...wallPoints(doc, wall));
        const end = wall.startVertexId === vertex.id ? 0 : length;
        return Math.abs(o.position * length - end) <= o.widthMm / 2 + .001 && middle > p.elevationMm && middle < p.elevationMm + p.heightMm;
      }));
      const join = wallJunctions({ ...doc, walls }).find((j) => j.id === vertex.id);
      return join ? [{ id: `junction:${vertex.id}:${index}`, sourceEntityId: walls[0]!.id, role: 'junction' as const,
        edgeFinishes: junctionFinishes(doc, walls, join.points),
        points: join.points.map((p) => ({ x: meters(p.x), y: meters(p.y) })), elevation: meters(bottom), height: meters(top - bottom),
        color: '#d8d5ce', topColor: top === Math.max(...walls.map((w) => wallConstruction(w).heightMm)) ? WALL_PLAN_COLOR : undefined }] : [];
    });
  });
}
