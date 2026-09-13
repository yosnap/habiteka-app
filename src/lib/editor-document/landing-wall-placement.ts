import type { EditorDocument, Point, Ramp } from './schema';
import { distance } from './geometry';
import { isRampLanding } from './ramp-kind';
import { localToWorld } from './spatial-properties';

const WALL_THICKNESS_MM = 150;

export interface LandingWallPlacement {
  points: [Point, Point];
  elevationMm: number;
  landingId: string;
}

export interface LandingEdgeSnap {
  point: Point;
  elevationMm: number;
  landingId: string;
  edge: { from: Point; to: Point };
}

/**
 * A wall drawn close to a landing edge belongs on its finished surface.
 * Projecting both endpoints to the same edge prevents a protection wall from
 * ending inside the solid landing body, where it would be hidden in 2D/3D.
 */
export function landingWallPlacement(doc: EditorDocument, points: [Point, Point], toleranceMm = 200): LandingWallPlacement | null {
  const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  const snapped = landingEdgeSnap(doc, midpoint, toleranceMm);
  if (!snapped) return null;
  return { points: [project(points[0], snapped.edge.from, snapped.edge.to), project(points[1], snapped.edge.from, snapped.edge.to)],
    elevationMm: snapped.elevationMm, landingId: snapped.landingId };
}

/** Finds the finished perimeter that a wall can physically rest on. */
export function landingEdgeSnap(doc: EditorDocument, point: Point, toleranceMm: number): LandingEdgeSnap | null {
  const candidates = (doc.ramps ?? []).filter(isRampLanding).flatMap((landing) => landingEdges(landing).map((edge) => {
    const projected = project(point, edge.from, edge.to);
    return { landing, edge, point: projected, gap: distance(point, projected), inside: insideLanding(point, landing) };
  })).filter((candidate) => candidate.inside || candidate.gap <= toleranceMm).sort((a, b) => a.gap - b.gap);
  const closest = candidates[0];
  if (!closest) return null;
  const edge = insetWallCenterline(closest.landing, closest.edge);
  return { point: project(point, edge.from, edge.to), edge, elevationMm: closest.landing.elevationMm, landingId: closest.landing.id };
}

function insideLanding(point: Point, landing: Ramp): boolean {
  const corners = landingEdges(landing).map((edge) => edge.from);
  return corners.reduce((inside, current, index) => {
    const previous = corners[(index + corners.length - 1) % corners.length]!;
    return (current.y > point.y) !== (previous.y > point.y) && point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x
      ? !inside : inside;
  }, false);
}

function landingEdges(landing: Ramp): { from: Point; to: Point }[] {
  const corners = [{ x: 0, y: 0 }, { x: landing.widthMm, y: 0 }, { x: landing.widthMm, y: landing.depthMm }, { x: 0, y: landing.depthMm }]
    .map((point) => localToWorld(landing, point));
  return corners.map((from, index) => ({ from, to: corners[(index + 1) % corners.length]! }));
}

/** The wall centreline is inset half its thickness, keeping its full body on the slab. */
function insetWallCenterline(landing: Ramp, edge: { from: Point; to: Point }): { from: Point; to: Point } {
  const center = localToWorld(landing, { x: landing.widthMm / 2, y: landing.depthMm / 2 });
  const midpoint = { x: (edge.from.x + edge.to.x) / 2, y: (edge.from.y + edge.to.y) / 2 };
  const length = Math.hypot(center.x - midpoint.x, center.y - midpoint.y);
  if (length < .001) return edge;
  const inset = WALL_THICKNESS_MM / 2, dx = (center.x - midpoint.x) / length * inset, dy = (center.y - midpoint.y) / length * inset;
  const span = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y), trim = Math.min(inset, span / 2);
  const tx = (edge.to.x - edge.from.x) / span * trim, ty = (edge.to.y - edge.from.y) / span * trim;
  return { from: { x: edge.from.x + dx + tx, y: edge.from.y + dy + ty },
    to: { x: edge.to.x + dx - tx, y: edge.to.y + dy - ty } };
}

function project(point: Point, from: Point, to: Point): Point {
  const dx = to.x - from.x, dy = to.y - from.y, lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared < .001 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return { x: from.x + dx * t, y: from.y + dy * t };
}
