import type { EditorDocument, Opening, Wall } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { meters, type SceneBox } from './types';
import { windowSealWidth } from './window-appearance';
import { openingType } from '@/lib/editor-document/opening-types';
import { openingFrameMm, openingLeafLayout, worldOpeningLeaves } from '@/lib/editor-document/opening-leaves';
import { openingLook } from '@/lib/editor-document/opening-look';
import { leafParts, leafSpan, SLIDING_RAIL_MM } from './opening-leaf-parts';
import { openingPartStyle, type PartTone } from './opening-part-style';
import { openingExtraParts } from './opening-extra-parts';

/** Marcos y vidrios siguen el arco del muro; las hojas de puerta son rígidas, sobre la cuerda entre jambas. */
export function curvedOpeningMeshes(doc: EditorDocument, wall: Wall, opening: Opening): SceneBox[] {
  const path = wallPath(doc, wall), props = openingConstruction(opening), boxes: SceneBox[] = [], type = openingType(opening)!, look = openingLook(opening);
  const frame = openingFrameMm(opening), from = opening.position - opening.widthMm / path.length / 2;
  const to = opening.position + opening.widthMm / path.length / 2, depth = wall.thicknessMm + 20;
  const add = (role: SceneBox['role'], x: number, z: number, y: number, width: number, height: number, thickness: number, angle: number,
    tone?: PartTone, shape?: SceneBox['shape']) => {
    boxes.push({ id: `${opening.id}:${boxes.length}`, sourceEntityId: opening.id, role,
      position: [meters(x), meters(props.elevationMm + y), meters(z)], size: [meters(width), meters(height), meters(thickness)], rotation: -angle,
      ...openingPartStyle(opening, type, look, role, tone), ...(shape ? { shape } : {}) });
  };
  const band = (start: number, end: number, y: number, height: number, thickness: number,
    role: SceneBox['role'] = 'frame', offset = 0) => {
    const points = path.samples(start, end);
    points.slice(1).forEach((b, i) => {
      const a = points[i]!, angle = Math.atan2(b.y - a.y, b.x - a.x);
      add(role, (a.x + b.x) / 2 - Math.sin(angle) * offset, (a.y + b.y) / 2 + Math.cos(angle) * offset,
        y, Math.hypot(b.x - a.x, b.y - a.y) + .2, height, thickness, angle);
    });
  };
  const innerFrom = from + frame / path.length, innerTo = to - frame / path.length;
  band(from, innerFrom, props.heightMm / 2, props.heightMm, depth);
  band(innerTo, to, props.heightMm / 2, props.heightMm, depth);
  band(from, to, props.heightMm - frame / 2, frame, depth);
  if (opening.kind === 'ventana') {
    band(from, to, frame / 2, frame, depth);
    if (type.operation === 'corredera-marco') {
      // Dos paños que se cruzan en el centro, cada uno en su carril.
      const overlap = 25 / path.length, offset = type.leafThicknessMm / 2 + 5;
      band(innerFrom, opening.position + overlap, props.heightMm / 2, props.heightMm - frame * 2, 8, 'glass', -offset);
      band(opening.position - overlap, innerTo, props.heightMm / 2, props.heightMm - frame * 2, 8, 'glass', offset);
    } else {
      // Montante central en la ventana histórica y en las de dos hojas; la fija y la de una hoja van sin él.
      if (type.operation === 'generica' || (type.operation === 'abatible' && type.leaves >= 2))
        band(opening.position - frame / path.length / 2, opening.position + frame / path.length / 2, props.heightMm / 2, props.heightMm - frame * 2, depth * .6);
      band(innerFrom, innerTo, props.heightMm / 2, props.heightMm - frame * 2, 8, 'glass');
    }
    const seal = windowSealWidth(frame);
    for (const side of [-1, 1]) {
      const face = side * (depth / 2 + 2);
      band(innerFrom, innerFrom + seal / path.length, props.heightMm / 2, props.heightMm - 2 * frame, 4, 'seal', face);
      band(innerTo - seal / path.length, innerTo, props.heightMm / 2, props.heightMm - 2 * frame, 4, 'seal', face);
      band(innerFrom, innerTo, props.heightMm - frame + seal / 2, seal, 4, 'seal', face);
      band(innerFrom, innerTo, frame - seal / 2, seal, 4, 'seal', face);
    }
    return boxes;
  }
  if (type.operation === 'corredera-marco') band(from, to, 10, 20, depth * .6);
  const layout = worldOpeningLeaves(doc, opening)!, span = leafSpan(type, props.heightMm, frame);
  for (const leaf of layout.leaves) for (const part of leafParts(leaf, type, span, look)) {
    const across = part.across ?? 0, cos = Math.cos(leaf.angle), sin = Math.sin(leaf.angle);
    add(part.role, leaf.center.x + cos * part.along - sin * across, leaf.center.y + sin * part.along + cos * across,
      part.y, part.length, part.height, part.thickness, leaf.angle, part.tone, part.shape);
  }
  // Herrajes de granero y guías de la seccional sobre la cuerda entre jambas; sin tapajuntas, que no siguen la curva.
  const { origin, direction, spanMm } = layout.frame, base = Math.atan2(direction.y, direction.x);
  const local = openingLeafLayout(opening, spanMm, wall.thicknessMm)!;
  for (const part of openingExtraParts(opening, type, look, local, { widthMm: opening.widthMm, heightMm: props.heightMm, frameMm: frame,
    wallThicknessMm: wall.thicknessMm, depthMm: depth, casing: false })) {
    const across = part.across ?? 0;
    add(part.role, origin.x + direction.x * part.along - direction.y * across, origin.y + direction.y * part.along + direction.x * across,
      part.y, part.length, part.height, part.thickness, base, part.tone, part.shape);
  }
  if (layout.rail && !type.barn) {
    const { from: start, to: end } = layout.rail;
    add('frame', (start.x + end.x) / 2, (start.y + end.y) / 2, props.heightMm - SLIDING_RAIL_MM / 2,
      Math.hypot(end.x - start.x, end.y - start.y), SLIDING_RAIL_MM, 60, Math.atan2(end.y - start.y, end.x - start.x));
  }
  return boxes;
}
