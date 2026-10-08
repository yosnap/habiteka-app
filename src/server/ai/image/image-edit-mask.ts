import type { CanvasZone, NormalizedPoint } from '@/lib/contracts';
import { resolveZone, InvalidZoneError } from '@/server/agent/feedback/zone-resolver';

/** Máscara binaria sin expansión ni suavizado fuera de la selección. */
export function imageEditMask(zone: CanvasZone, width: number, height: number): Buffer {
  const box = resolveZone(zone);
  const mask = Buffer.alloc(width * height);
  let selected = 0;
  for (let y = Math.max(0, Math.floor(box.y * height)); y < Math.min(height, Math.ceil((box.y + box.height) * height)); y++) {
    for (let x = Math.max(0, Math.floor(box.x * width)); x < Math.min(width, Math.ceil((box.x + box.width) * width)); x++) {
      const point = { x: (x + .5) / width, y: (y + .5) / height };
      const inside = zone.polygon ? insidePolygon(point, zone.polygon)
        : point.x >= box.x && point.x < box.x + box.width && point.y >= box.y && point.y < box.y + box.height;
      if (inside) { mask[y * width + x] = 255; selected++; }
    }
  }
  if (selected < 4) throw new InvalidZoneError('La zona es demasiado pequeña. Amplía la selección.');
  return mask;
}

function insidePolygon(p: NormalizedPoint, points: NormalizedPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
