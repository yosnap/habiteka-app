import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { wallPath } from '@/lib/editor-document/wall-path';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

function targets(regions: ZoneMaskRegions): Point[] {
  return regions.flatMap((polygon) => {
    const xs = polygon.map((point) => point.x), ys = polygon.map((point) => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // Interior samples, never the boundary itself: a rear/side wall must remain visible.
    return [0.2, 0.5, 0.8].flatMap((y) => [0.2, 0.5, 0.8].map((x) => ({
      x: minX + (maxX - minX) * x, y: minY + (maxY - minY) * y,
    })).filter((point) => pointInPolygon(point, polygon)));
  });
}

function crossingDistance(eye: Point, target: Point, a: Point, b: Point): number | null {
  const dx = target.x - eye.x, dy = target.y - eye.y;
  const wx = b.x - a.x, wy = b.y - a.y;
  const determinant = dx * wy - dy * wx;
  if (Math.abs(determinant) < 1e-5) return null;
  const px = a.x - eye.x, py = a.y - eye.y;
  const alongSight = (px * wy - py * wx) / determinant;
  const alongWall = (px * dy - py * dx) / determinant;
  return alongSight > .001 && alongSight < .97 && alongWall >= 0 && alongWall <= 1 ? alongSight : null;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared ? Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - a.x - along * dx, point.y - a.y - along * dy);
}

/** Solo el cerramiento del borde de la zona; un muro del patio anterior no es su fachada. */
function bordersZone(a: Point, b: Point, regions: ZoneMaskRegions, toleranceMm: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (!length) return false;
  return regions.some((polygon) => polygon.some((edge, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    const ex = next.x - edge.x, ey = next.y - edge.y, edgeLength = Math.hypot(ex, ey);
    if (!edgeLength || Math.abs(dx * ex + dy * ey) / (length * edgeLength) < .9) return false;
    return Math.min(distanceToSegment(a, edge, next), distanceToSegment(b, edge, next),
      distanceToSegment(edge, a, b), distanceToSegment(next, a, b)) <= toleranceMm;
  }));
}

/** Recorte temporal de los muros que cruzan la vista hacia una zona concreta. */
export function zoneOccludingWallIds(document: EditorDocument, camera: { x: number; y: number; z: number },
  regions: ZoneMaskRegions, targetHeightM = 1.5): string[] {
  const eye = { x: camera.x * 1000, y: camera.z * 1000 };
  if (regions.some((region) => pointInPolygon(eye, region))) return [];
  const points = targets(regions);
  if (!points.length) return [];
  const facingExteriors = new Set(editorDocumentToScene(document).exteriorWalls
    .filter(wall => (camera.x - wall.x) * wall.normalX + (camera.z - wall.z) * wall.normalZ > .01)
    .map(wall => wall.sourceEntityId));
  return document.walls.filter((wall) => {
    if (wall.hidden || !facingExteriors.has(wall.id)) return false;
    const path = wallPath(document, wall);
    const segments = wall.curveHeightMm ? path.samples() : [path.at(0), path.at(1)];
    const bottom = (wall.baseElevationMm ?? 0) / 1000;
    const top = bottom + wallConstruction(wall).heightMm / 1000;
    return segments.slice(1).some((end, index) =>
      bordersZone(segments[index]!, end, regions, Math.max(350, wall.thicknessMm + 100)) &&
      points.some((target) => {
        const distance = crossingDistance(eye, target, segments[index]!, end);
        if (distance === null) return false;
        const crossingHeight = camera.y + (targetHeightM - camera.y) * distance;
        return crossingHeight >= bottom && crossingHeight <= top;
      }));
  }).map((wall) => wall.id);
}
