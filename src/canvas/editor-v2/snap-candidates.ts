import { planObjects } from '@/lib/editor-document/boundary-types';
import { alignPoint, type MagneticGuide } from './magnetic-alignment';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { distance } from '@/lib/editor-document/geometry';
import { findWallExtension, type WallExtension } from './wall-extension';
import { wallPath } from '@/lib/editor-document/wall-path';
import { landingEdgeSnap } from '@/lib/editor-document/landing-wall-placement';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';
import { snapRadiusMm } from './snap-radius';

export interface SnapCandidate { guides?: MagneticGuide[]; point: Point; kind: 'vertex' | 'wall' | 'landing' | 'object' | 'orthogonal' | 'extension' | 'free'; id?: string; extension?: WallExtension; guide?: { from: Point; to: Point } }
function spatialCorners(item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }): Point[] {
  return [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }]
    .map((point) => localToWorld(item, point));
}
function spatialSnapCandidates(doc: EditorDocument) {
  const objects = [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.columns ?? [])]
    .flatMap((item) => spatialCorners(item).map((point) => ({ point, id: item.id })));
  const ramps = (doc.ramps ?? []).flatMap((ramp) => rampParts(ramp).flatMap((part) => rampPartFootprint(ramp, part)
    .map((point) => ({ point, id: ramp.id }))));
  return [...objects, ...ramps];
}
/** Distances are measured in screen pixels (with a floor in mm), so magnetic reach does not grow when zooming in. */
export function snapWallPoint(doc: EditorDocument, point: Point, scale: number, enabled: boolean, anchor?: Point): SnapCandidate {
  if (!enabled) return { point, kind: 'free' };
  const radius = snapRadiusMm(scale, 12);
  const candidates: (SnapCandidate & { gap: number; priority: number })[] = [];
  for (const v of doc.vertices) candidates.push({ point: { x: v.x, y: v.y }, kind: 'vertex', id: v.id, gap: distance(point, v), priority: 0 });
  for (const wall of doc.walls) {
    const path = wallPath(doc, wall), projected = path.at(path.project(point));
    candidates.push({ point: projected, kind: 'wall', id: wall.id, gap: distance(point, projected), priority: 1 });
  }
  for (const object of spatialSnapCandidates(doc)) {
    candidates.push({ ...object, kind: 'object', gap: distance(point, object.point), priority: 1 });
  }
  const landing = landingEdgeSnap(doc, point, Math.max(radius, 200));
  if (landing) candidates.push({ point: landing.point, kind: 'landing', id: landing.landingId, guide: landing.edge, gap: distance(point, landing.point), priority: 2 });
  // Corners win over their incident wall projection: otherwise a near-corner click creates a tiny split instead of closing.
  const nearest = candidates.filter((c) => c.gap <= radius).sort((a, b) => a.priority - b.priority || a.gap - b.gap || (a.id ?? '').localeCompare(b.id ?? ''))[0];
  if (nearest) return { ...nearest, guides: nearest.guide ? [nearest.guide] : alignPoint(doc, nearest.point, 100, true).guides };
  if (anchor) {
    const extension = findWallExtension(doc, anchor, point, radius);
    if (extension) return { kind: 'extension', point: extension.point, id: extension.wallId, extension };
    const dx = Math.abs(point.x - anchor.x), dy = Math.abs(point.y - anchor.y);
    if (Math.min(dx, dy) <= radius) {
      const aligned = dx < dy ? { x: anchor.x, y: point.y } : { x: point.x, y: anchor.y };
      return { kind: 'orthogonal', point: aligned, guides: [{ from: anchor, to: aligned }] };
    }
  }
  // Un extremo de muro se alinea con ejes y vértices, nunca con caras: así no nacen esquinas fantasma a medio grosor.
  const aligned = alignPoint(doc, point, scale, enabled, [], { faces: false, toleranceMm: snapRadiusMm(scale, 10) });
  return { point: aligned.point, kind: Math.hypot(aligned.delta.x, aligned.delta.y) > .001 ? 'object' : 'free', guides: aligned.guides };
}
