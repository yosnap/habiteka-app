import { alignPoints, magneticReferences, type MagneticGuide } from './magnetic-alignment';
import type { EditorDocument, Opening, Point } from '@/lib/editor-document/schema';
import { distance, EPSILON } from '@/lib/editor-document/geometry';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { assertOpeningClearance, wallOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { wallPath } from '@/lib/editor-document/wall-path';

export interface OpeningPlacement {
  guides?: MagneticGuide[];
  wallId: string;
  position: number;
  center: Point;
  rotation: number;
  beforeMm: number;
  afterMm: number;
  valid: boolean;
  reason: string | null;
}

/** Same resolver drives preview and commit; tolerances stay constant on screen. */
export function resolveOpeningPlacement(doc: EditorDocument, pointer: Point, scale: number,
  opening: Opening, previousHost?: string, grabOffsetMm = 0, snap = false): OpeningPlacement | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const candidates = doc.walls.filter((wall) => !wall.hidden).map((wall) => {
    const path = wallPath(doc, wall), length = path.length, position = path.project(pointer);
    const gap = distance(pointer, path.at(position)) * scale;
    return { wall, path, length, position, gap };
  }).filter(({ wall, gap }) => gap <= 24 + wall.thicknessMm * scale / 2)
    .sort((a, b) => (a.gap - (a.wall.id === previousHost ? 5 : 0)) -
      (b.gap - (b.wall.id === previousHost ? 5 : 0)) || a.wall.id.localeCompare(b.wall.id));
  const candidate = candidates[0];
  if (!candidate) return null;
  const { wall, path, length } = candidate;
  const half = opening.widthMm / length / 2;
  const clearance = wallOpeningClearance(doc, wall);
  const minimum = half + clearance.startMm / length, maximum = 1 - half - clearance.endMm / length;
  let position = minimum <= maximum ? Math.max(minimum, Math.min(maximum, candidate.position - grabOffsetMm / length)) : .5;
  if (snap && minimum <= maximum) {
    const direction = path.tangent(position), references = magneticReferences(doc, [opening.id]);
    let best = Infinity;
    for (const offset of [-half, 0, half]) {
      const anchor = path.at(position + offset);
      for (const target of references) for (const axis of ['x', 'y'] as const) {
        if (Math.abs(direction[axis]) < .01) continue;
        const shift = (target[axis] - anchor[axis]) / direction[axis];
        const next = position + shift / length;
        if (next >= minimum && next <= maximum && Math.abs(shift) <= 10 / scale && Math.abs(shift) < Math.abs(best)) best = shift;
      }
    }
    if (Number.isFinite(best)) position += best / length;
  }
  const direction = path.tangent(position);
  const guides = alignPoints(doc, [-half, 0, half].map((offset) => path.at(position + offset)), 100, snap, [opening.id]).guides;
  const result: OpeningPlacement = { guides, wallId: wall.id, position, center: path.at(position),
    rotation: Math.atan2(direction.y, direction.x) * 180 / Math.PI,
    beforeMm: position * length - opening.widthMm / 2,
    afterMm: (1 - position) * length - opening.widthMm / 2, valid: true, reason: null };
  // Preview changes only one opening: avoid validating the entire wall topology per frame.
  // Commit still validates the complete document at the authoritative boundary.
  const props = openingConstruction(opening), start = position * length - opening.widthMm / 2;
  const end = start + opening.widthMm;
  if (!Number.isFinite(opening.widthMm) || opening.widthMm <= 0 || half > .5)
    result.reason = 'La abertura no cabe en este muro';
  else if (minimum > maximum + EPSILON)
    result.reason = 'La abertura no cabe entre las esquinas del muro';
  else if (props.heightMm + props.elevationMm > wallConstruction(wall).heightMm + EPSILON)
    result.reason = 'La abertura supera la altura del muro';
  else if (doc.openings.some((other) => other.id !== opening.id && other.wallId === wall.id &&
    start < other.position * length + other.widthMm / 2 - EPSILON &&
    end > other.position * length - other.widthMm / 2 + EPSILON)) result.reason = 'Aberturas superpuestas';
  result.valid = result.reason === null;
  return result;
}

export function placeOpening(doc: EditorDocument, opening: Opening,
  placement: Pick<OpeningPlacement, 'wallId' | 'position'>): EditorDocument {
  assertOpeningClearance(doc, { ...opening, ...placement });
  const next = upgradeConstructionDocument(doc);
  next.openings = next.openings.filter((item) => item.id !== opening.id);
  next.openings.push({ ...opening, ...openingConstruction(opening), wallId: placement.wallId, position: placement.position,
    ...(next.schemaVersion >= 4 ? { colors: opening.colors ?? { frame: '#f4f1e9', leaf: '#bb956c' } } : {}) });
  assertEditorDocument(next);
  return next;
}
