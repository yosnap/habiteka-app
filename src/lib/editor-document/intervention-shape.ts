import type { SitePoint } from './geographic-site';
export function interventionShape(points: SitePoint[]) {
  const center = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
  const a = points[0]!, b = points[1]!, c = points[2]!;
  return { center, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    width: Math.hypot(b.x - a.x, b.y - a.y), depth: Math.hypot(c.x - b.x, c.y - b.y) };
}
export function rotateIntervention(points: SitePoint[], degrees: number): SitePoint[] {
  const { center, angle } = interventionShape(points), delta = (degrees - angle) * Math.PI / 180;
  return points.map(p => ({ x: center.x + (p.x - center.x) * Math.cos(delta) - (p.y - center.y) * Math.sin(delta),
    y: center.y + (p.x - center.x) * Math.sin(delta) + (p.y - center.y) * Math.cos(delta) }));
}
export function resizeIntervention(points: SitePoint[], axis: 'width' | 'depth', size: number): SitePoint[] {
  const shape = interventionShape(points), angle = shape.angle * Math.PI / 180;
  const factor = size / Math.max(shape[axis], .00001);
  return points.map(p => {
    const dx = p.x - shape.center.x, dy = p.y - shape.center.y;
    const x = (dx * Math.cos(angle) + dy * Math.sin(angle)) * (axis === 'width' ? factor : 1);
    const y = (-dx * Math.sin(angle) + dy * Math.cos(angle)) * (axis === 'depth' ? factor : 1);
    return { x: shape.center.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: shape.center.y + x * Math.sin(angle) + y * Math.cos(angle) };
  });
}
export function moveIntervention(points: SitePoint[], dx: number, dy: number): SitePoint[] {
  dx = Math.max(-Math.min(...points.map(p => p.x)), Math.min(1 - Math.max(...points.map(p => p.x)), dx));
  dy = Math.max(-Math.min(...points.map(p => p.y)), Math.min(1 - Math.max(...points.map(p => p.y)), dy));
  return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
}
