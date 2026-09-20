import type { Point } from '@/lib/editor-document/schema';
import type { DimensionLayout } from './dimension-layout';

export function drawingDimension(a: Point, b: Point, scale: number): DimensionLayout | null {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1 || scale <= 0) return null;
  const offset = 75 + 36 / scale;
  const dx = (b.y - a.y) / length * offset, dy = -(b.x - a.x) / length * offset;
  return { sourceFrom: a, sourceTo: b, from: { x: a.x + dx, y: a.y + dy }, to: { x: b.x + dx, y: b.y + dy } };
}
export function rectangleDimensions(a: Point, b: Point, scale: number): DimensionLayout[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  return [drawingDimension({ x: left, y: top }, { x: right, y: top }, scale),
    drawingDimension({ x: right, y: top }, { x: right, y: bottom }, scale)].filter((d): d is DimensionLayout => Boolean(d));
}
