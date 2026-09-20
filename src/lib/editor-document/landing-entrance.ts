import type { EditorDocument, Point, Ramp, Wall } from './schema';
import { distance } from './geometry';
import { wallOpeningClearance } from './opening-clearance';
import { localToWorld } from './spatial-properties';
import { wallPath } from './wall-path';

export interface LandingEntranceTarget {
  wall: Wall;
  position: number;
  widthMm: number;
}

/** Finds the wall face that a horizontal landing is actually touching. */
export function landingEntranceTarget(doc: EditorDocument, landing: Ramp): LandingEntranceTarget | null {
  const corners = [
    localToWorld(landing, { x: 0, y: 0 }),
    localToWorld(landing, { x: landing.widthMm, y: 0 }),
    localToWorld(landing, { x: landing.widthMm, y: landing.depthMm }),
    localToWorld(landing, { x: 0, y: landing.depthMm }),
  ];
  const candidates = doc.walls.filter((wall) => !wall.hidden).flatMap((wall) => {
    const path = wallPath(doc, wall);
    return corners.map((start, index) => {
      const end = corners[(index + 1) % corners.length]!, midpoint = middle(start, end), position = path.project(midpoint), tangent = path.tangent(position);
      const edgeLength = distance(start, end);
      const edgeDirection = { x: (end.x - start.x) / edgeLength, y: (end.y - start.y) / edgeLength };
      const parallel = Math.abs(edgeDirection.x * tangent.x + edgeDirection.y * tangent.y);
      const clearance = wallOpeningClearance(doc, wall), length = path.length;
      const edgeStartMm = Math.min(path.project(start), path.project(end)) * length;
      const edgeEndMm = Math.max(path.project(start), path.project(end)) * length;
      const fromMm = Math.max(clearance.startMm, edgeStartMm), toMm = Math.min(length - clearance.endMm, edgeEndMm);
      return { wall, position: (fromMm + toMm) / 2 / length, widthMm: toMm - fromMm,
        gapMm: distance(midpoint, path.at(position)), parallel };
    });
  }).filter((candidate) => candidate.parallel >= .98 && candidate.widthMm >= 50 && candidate.gapMm <= candidate.wall.thicknessMm / 2 + 300)
    .sort((a, b) => a.gapMm - b.gapMm || a.wall.id.localeCompare(b.wall.id));
  const target = candidates[0];
  return target ? { wall: target.wall, position: target.position, widthMm: target.widthMm } : null;
}

function middle(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
