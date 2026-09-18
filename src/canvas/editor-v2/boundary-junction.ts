import type { Furniture } from '@/lib/editor-document/schema';
import { localToWorld } from '@/lib/editor-document/spatial-properties';

/** A shared end may overlap at its joint, but duplicate/near-parallel runs cannot. */
export function isBoundaryJoint(a: Furniture, b: Furniture): boolean {
  const boundary = (item: Furniture) => /^habiteka:outdoor:(valla-madera|cerca-metal|seto)$/.test(item.catalogId ?? '');
  if (!boundary(a) || !boundary(b)) return false;
  const ends = (item: Furniture) => [0, item.widthMm].map((x) => localToWorld(item, { x, y: item.depthMm / 2 }));
  const ae = ends(a), be = ends(b);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const p = ae[i]!, q = be[j]!;
    if (Math.hypot(p.x - q.x, p.y - q.y) > .01) continue;
    const u = ae[1 - i]!, v = be[1 - j]!;
    const cosine = ((u.x - p.x) * (v.x - q.x) + (u.y - p.y) * (v.y - q.y)) / (a.widthMm * b.widthMm);
    if (cosine < Math.cos(Math.PI / 12)) return true;
  }
  return false;
}
