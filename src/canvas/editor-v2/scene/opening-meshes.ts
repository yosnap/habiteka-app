import type { EditorDocument, Opening } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { meters, type SceneBox } from './types';
import { wallPath } from '@/lib/editor-document/wall-path';
import { curvedOpeningMeshes } from './curved-opening-meshes';
import { windowSealWidth } from './window-appearance';
import { openingType } from '@/lib/editor-document/opening-types';
import { openingFrameMm, openingLeafLayout } from '@/lib/editor-document/opening-leaves';
import { openingLook } from '@/lib/editor-document/opening-look';
import { leafParts, leafSpan, SLIDING_RAIL_MM } from './opening-leaf-parts';
import { openingPartStyle, type PartTone } from './opening-part-style';
import { openingExtraParts } from './opening-extra-parts';

export function openingMeshes(doc: EditorDocument, opening: Opening): SceneBox[] {
  if (opening.kind === 'hueco') return [];
  const wall = doc.walls.find((w) => w.id === opening.wallId)!;
  if (wall.curveHeightMm) return curvedOpeningMeshes(doc, wall, opening);
  const path = wallPath(doc, wall), a = path.at(opening.position), direction = path.tangent(opening.position), angle = Math.atan2(direction.y, direction.x);
  const center = 0, p = openingConstruction(opening), width = opening.widthMm, type = openingType(opening)!, look = openingLook(opening);
  const boxes: SceneBox[] = [], frame = openingFrameMm(opening), depth = wall.thicknessMm + 20;
  const add = (role: SceneBox['role'], x: number, y: number, z: number, w: number, h: number, d: number, rotation = angle,
    tone?: PartTone, shape?: SceneBox['shape']) => {
    boxes.push({ id: `${opening.id}:${boxes.length}`, sourceEntityId: opening.id, role,
      position: [meters(a.x + Math.cos(angle) * (center + x) - Math.sin(angle) * z), meters(p.elevationMm + y),
        meters(a.y + Math.sin(angle) * (center + x) + Math.cos(angle) * z)],
      size: [meters(w), meters(h), meters(d)], rotation: -rotation,
      ...openingPartStyle(opening, type, look, role, tone), ...(shape ? { shape } : {}) });
  };
  add('frame', -width / 2 + frame / 2, p.heightMm / 2, 0, frame, p.heightMm, depth);
  add('frame', width / 2 - frame / 2, p.heightMm / 2, 0, frame, p.heightMm, depth);
  add('frame', 0, p.heightMm - frame / 2, 0, width, frame, depth);
  if (opening.kind === 'ventana') {
    add('frame', 0, frame / 2, 0, width, frame, depth);
    // La ventana histórica conserva su montante central y su vidrio único; la fija, solo el vidrio.
    if (type.operation === 'generica') add('frame', 0, p.heightMm / 2, 0, frame, p.heightMm - 2 * frame, depth * .6);
    if (type.operation === 'generica' || type.operation === 'fija')
      add('glass', 0, p.heightMm / 2, 0, width - 2 * frame, p.heightMm - 2 * frame, 8);
    const seal = windowSealWidth(frame), innerWidth = width - 2 * frame;
    for (const side of [-1, 1]) {
      const face = side * (depth / 2 + 2);
      add('seal', -innerWidth / 2 + seal / 2, p.heightMm / 2, face, seal, p.heightMm - 2 * frame, 4);
      add('seal', innerWidth / 2 - seal / 2, p.heightMm / 2, face, seal, p.heightMm - 2 * frame, 4);
      add('seal', 0, p.heightMm - frame + seal / 2, face, innerWidth, seal, 4);
      add('seal', 0, frame - seal / 2, face, innerWidth, seal, 4);
    }
  } else if (type.operation === 'corredera-marco') add('frame', 0, 10, 0, width, 20, depth * .6);
  // Hojas y paños: la misma disposición que el símbolo 2D y el barrido, sobre la luz libre del marco.
  const layout = openingLeafLayout(opening, width - 2 * frame, wall.thicknessMm)!, span = leafSpan(type, p.heightMm, frame);
  for (const panel of layout.panels) for (const part of leafParts(panel, type, span, look)) {
    const across = part.across ?? 0, cos = Math.cos(panel.angle), sin = Math.sin(panel.angle);
    add(part.role, panel.center.x + cos * part.along - sin * across, part.y, panel.center.y + sin * part.along + cos * across,
      part.length, part.height, part.thickness, angle + panel.angle, part.tone, part.shape);
  }
  // La galería tapa la guía de la corredera vista; la de granero lleva su pletina con ruedas a la vista.
  if (layout.rail && !type.barn) add('frame', (layout.rail.from.x + layout.rail.to.x) / 2, p.heightMm - SLIDING_RAIL_MM / 2, layout.rail.from.y,
    layout.rail.to.x - layout.rail.from.x, SLIDING_RAIL_MM, 60);
  for (const part of openingExtraParts(opening, type, look, layout, { widthMm: width, heightMm: p.heightMm, frameMm: frame,
    wallThicknessMm: wall.thicknessMm, depthMm: depth, casing: true }))
    add(part.role, part.along, part.y, part.across ?? 0, part.length, part.height, part.thickness, angle, part.tone, part.shape);
  return boxes;
}
