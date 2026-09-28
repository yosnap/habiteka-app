import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { wallPath } from '@/lib/editor-document/wall-path';
import { wallConstruction } from '@/lib/editor-document/construction-properties';

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

/** Recorte temporal de los muros que cruzan la vista hacia una zona concreta. */
export function zoneOccludingWallIds(document: EditorDocument, camera: { x: number; y: number; z: number },
  regions: ZoneMaskRegions, targetHeightM = 1.5): string[] {
  const eye = { x: camera.x * 1000, y: camera.z * 1000 };
  if (regions.some((region) => pointInPolygon(eye, region))) return [];
  const points = targets(regions);
  if (!points.length) return [];
  return document.walls.filter((wall) => {
    if (wall.hidden) return false;
    const path = wallPath(document, wall);
    const segments = wall.curveHeightMm ? path.samples() : [path.at(0), path.at(1)];
    const bottom = (wall.baseElevationMm ?? 0) / 1000;
    const top = bottom + wallConstruction(wall).heightMm / 1000;
    return segments.slice(1).some((end, index) =>
      points.some((target) => {
        const distance = crossingDistance(eye, target, segments[index]!, end);
        if (distance === null) return false;
        const crossingHeight = camera.y + (targetHeightM - camera.y) * distance;
        return crossingHeight >= bottom && crossingHeight <= top;
      }));
  }).map((wall) => wall.id);
}
