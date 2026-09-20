import type { EditorDocument, Point, Ramp } from './schema';
import { localToWorld } from './spatial-properties';
import { wallPath } from './wall-path';
import { isRampLanding } from './ramp-kind';
import { openingConstruction } from './construction-properties';

export interface LandingEntranceSurface {
  openingId: string;
  landing: Ramp;
  points: Point[];
}

/** Extends only the part of a landing edge aligned with an existing doorless opening. */
export function landingEntranceSurfaces(doc: EditorDocument): LandingEntranceSurface[] {
  return doc.openings.filter((o) => o.kind === 'hueco').flatMap((opening) => {
    const wall = doc.walls.find((w) => w.id === opening.wallId);
    if (!wall || wall.curveHeightMm || wall.hidden) return [];
    const path = wallPath(doc, wall), center = path.at(opening.position), tangent = path.tangent(opening.position);
    const normal = { x: -tangent.y, y: tangent.x };
    const project = (p: Point) => ({ x: (p.x - center.x) * tangent.x + (p.y - center.y) * tangent.y,
      y: (p.x - center.x) * normal.x + (p.y - center.y) * normal.y });
    const candidates = (doc.ramps ?? []).filter((r) => isRampLanding(r) &&
      (!opening.sourceRampId || opening.sourceRampId === r.id) &&
      Math.abs(r.elevationMm - openingConstruction(opening).elevationMm) <= 1).flatMap((landing) => {
      const corners = [{ x: 0, y: 0 }, { x: landing.widthMm, y: 0 },
        { x: landing.widthMm, y: landing.depthMm }, { x: 0, y: landing.depthMm }]
        .map((p) => project(localToWorld(landing, p)));
      const landingSide = project(localToWorld(landing, { x: landing.widthMm / 2, y: landing.depthMm / 2 })).y >= 0 ? 1 : -1;
      return corners.flatMap((a, index) => {
        const b = corners[(index + 1) % 4]!;
        if (Math.abs(a.y - b.y) > 1) return [];
        const edgeY = (a.y + b.y) / 2;
        if (Math.abs(edgeY) > wall.thicknessMm / 2 + 300 || edgeY * landingSide < -wall.thicknessMm / 2) return [];
        const from = Math.max(-opening.widthMm / 2, Math.min(a.x, b.x));
        const to = Math.min(opening.widthMm / 2, Math.max(a.x, b.x));
        if (to - from < 1) return [];
        const farY = -landingSide * wall.thicknessMm / 2;
        if (Math.abs(edgeY - farY) < .1) return [];
        const points = [{ x: from, y: edgeY }, { x: to, y: edgeY }, { x: to, y: farY }, { x: from, y: farY }]
          .map((p) => ({ x: center.x + tangent.x * p.x + normal.x * p.y, y: center.y + tangent.y * p.x + normal.y * p.y }));
        return [{ openingId: opening.id, landing, points, gap: Math.abs(edgeY) }];
      });
    }).sort((a, b) => a.gap - b.gap);
    return candidates[0] ? [candidates[0]] : [];
  });
}

export function entranceLocalPoints(surface: LandingEntranceSurface): Point[] {
  const angle = -surface.landing.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return surface.points.map((p) => ({ x: (p.x - surface.landing.x) * c - (p.y - surface.landing.y) * s,
    y: (p.x - surface.landing.x) * s + (p.y - surface.landing.y) * c }));
}

/** Keeps the outline editable, without drawing a seam across the connected entrance. */
export function landingOutlineSegments(landing: Ramp, surfaces: LandingEntranceSurface[]): Point[][] {
  const corners = [{ x: 0, y: 0 }, { x: landing.widthMm, y: 0 },
    { x: landing.widthMm, y: landing.depthMm }, { x: 0, y: landing.depthMm }];
  const contacts = surfaces.filter((s) => s.landing.id === landing.id).map((s) => entranceLocalPoints(s).slice(0, 2));
  return corners.flatMap((a, i) => {
    const b = corners[(i + 1) % 4]!, dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    const position = (p: Point) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / length;
    const intervals = contacts.filter((pair) => pair.every((p) => Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / length < 1))
      .map((pair) => [Math.max(0, Math.min(...pair.map(position))), Math.min(length, Math.max(...pair.map(position)))])
      .sort((x, y) => x[0]! - y[0]!);
    const point = (t: number) => ({ x: a.x + dx * t / length, y: a.y + dy * t / length });
    const result: Point[][] = [];
    let cursor = 0;
    for (const [from, to] of intervals) {
      if (from! > cursor) result.push([point(cursor), point(from!)]);
      cursor = Math.max(cursor, to!);
    }
    if (cursor < length) result.push([point(cursor), b]);
    return result;
  });
}
