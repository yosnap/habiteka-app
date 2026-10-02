import type { PlanPoint, PlanWall, PlanZone } from '@/lib/contracts';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';

type Size = { w: number; h: number };
const CLEARANCE_MM = 10;
const SEARCH_STEP_MM = 75;

function pointSegmentDistance(point: PlanPoint, a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function cross(a: PlanPoint, b: PlanPoint, c: PlanPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsMeet(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return pointSegmentDistance(c, a, b) < 0.001 || pointSegmentDistance(d, a, b) < 0.001
    || pointSegmentDistance(a, c, d) < 0.001 || pointSegmentDistance(b, c, d) < 0.001;
}

function segmentDistance(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint): number {
  if (segmentsMeet(a, b, c, d)) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

function corners(center: PlanPoint, size: Size): PlanPoint[] {
  const x = size.w / 2, y = size.h / 2;
  return [{ x: center.x - x, y: center.y - y }, { x: center.x + x, y: center.y - y },
    { x: center.x + x, y: center.y + y }, { x: center.x - x, y: center.y + y }];
}

function fits(center: PlanPoint, size: Size, zone: PlanZone, walls: PlanWall[]): boolean {
  const points = corners(center, size);
  if (points.some((point) => !pointInPolygon(point, zone.outline))) return false;
  const edges = points.map((point, index) => [point, points[(index + 1) % points.length]!] as const);
  // En un contorno cóncavo las esquinas pueden quedar dentro y un lado cruzar fuera.
  for (const [a, b] of edges)
    for (let index = 0; index < zone.outline.length; index++) {
      const c = zone.outline[index]!, d = zone.outline[(index + 1) % zone.outline.length]!;
      if (cross(a, b, c) * cross(a, b, d) < 0 && segmentsMeet(a, b, c, d)) return false;
    }
  return walls.every((wall) => edges.every(([a, b]) =>
    segmentDistance(a, b, wall.from, wall.to) >= wall.thicknessMm / 2 + CLEARANCE_MM));
}

/**
 * Conserva el centro leído siempre que cabe. Si la huella del catálogo pisa
 * un muro, busca el desplazamiento mínimo cercano; nunca mueve a otra estancia.
 */
export function fitFurnitureNearSource(
  source: PlanPoint, size: Size, zone: PlanZone, walls: PlanWall[],
): PlanPoint | null {
  if (fits(source, size, zone, walls)) return source;
  const maxShift = Math.min(450, Math.max(175, Math.min(size.w, size.h) * 0.35));
  const steps = Math.ceil(maxShift / SEARCH_STEP_MM);
  const offsets: PlanPoint[] = [];
  for (let y = -steps; y <= steps; y++)
    for (let x = -steps; x <= steps; x++) {
      const dx = x * SEARCH_STEP_MM, dy = y * SEARCH_STEP_MM;
      if (dx * dx + dy * dy <= maxShift * maxShift) offsets.push({ x: dx, y: dy });
    }
  offsets.sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y || a.y - b.y || a.x - b.x);
  for (const offset of offsets) {
    const candidate = { x: source.x + offset.x, y: source.y + offset.y };
    if (fits(candidate, size, zone, walls)) return candidate;
  }
  return null;
}
