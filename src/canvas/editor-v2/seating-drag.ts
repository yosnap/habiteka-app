import type { EditorDocument, Furniture, Point } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { footprint, furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { objectSolids, penetration, type Solid } from './spatial-placement';

const profile = (item: Furniture) => getFurnitureCatalogEntry(item.catalogId)?.profile;
const pairs = (a: Furniture, b: Furniture) => ['chair', 'bench'].includes(profile(a) ?? '') && profile(b) === 'table'
  || profile(a) === 'table' && ['chair', 'bench'].includes(profile(b) ?? '');
const bounds = (solid: Pick<Solid, 'polygon'>) => ({ left: Math.min(...solid.polygon.map((p) => p.x)), right: Math.max(...solid.polygon.map((p) => p.x)),
  front: Math.min(...solid.polygon.map((p) => p.y)), back: Math.max(...solid.polygon.map((p) => p.y)) });
type BoundedSolid = Solid & { bounds: ReturnType<typeof bounds> };
const bounded = (solid: Solid): BoundedSolid => ({ ...solid, bounds: bounds(solid) });

/** SAT continuo: devuelve el primer contacto aunque el puntero salte al otro lado de una pata entre eventos. */
function firstContact(a: BoundedSolid, b: BoundedSolid, delta: Point): number {
  if (Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) <= 1) return 1;
  if (a.bounds.right + Math.max(0, delta.x) <= b.bounds.left || a.bounds.left + Math.min(0, delta.x) >= b.bounds.right
    || a.bounds.back + Math.max(0, delta.y) <= b.bounds.front || a.bounds.front + Math.min(0, delta.y) >= b.bounds.back) return 1;
  if (penetration(a, b)) return 1; // Permite sacar una intersección heredada; la validación final impide empeorarla.
  let entry = -Infinity, exit = Infinity;
  for (const polygon of [a.polygon, b.polygon]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!, length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length < .001) continue;
    const nx = -(q.y - p.y) / length, ny = (q.x - p.x) / length;
    const ap = a.polygon.map((p) => p.x * nx + p.y * ny), bp = b.polygon.map((p) => p.x * nx + p.y * ny);
    const minA = Math.min(...ap), maxA = Math.max(...ap), minB = Math.min(...bp) + 1, maxB = Math.max(...bp) - 1;
    const speed = delta.x * nx + delta.y * ny;
    if (Math.abs(speed) < 1e-8) { if (maxA <= minB || minA >= maxB) return 1; continue; }
    const t0 = (minB - maxA) / speed, t1 = (maxB - minA) / speed;
    entry = Math.max(entry, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
    if (entry >= exit) return 1;
  }
  return entry < 1 && exit > 0 ? Math.max(0, entry) : 1;
}

/** Solo el arrastre individual de mesa/asiento: se detiene ante piezas físicas y permite rodearlas. */
export function constrainSeatingDrag(doc: EditorDocument, from: Furniture, target: Furniture): Furniture {
  const start = bounds({ polygon: footprint(from) }), end = bounds({ polygon: footprint(target) });
  const movingSpatial = furnitureSpatial(from);
  const others = doc.furniture.filter((item) => {
    if (item.id === from.id || !pairs(from, item)) return false;
    const spatial = furnitureSpatial(item);
    if (Math.min(movingSpatial.elevationMm + movingSpatial.heightMm, spatial.elevationMm + spatial.heightMm)
      - Math.max(movingSpatial.elevationMm, spatial.elevationMm) <= 1) return false;
    const other = bounds({ polygon: footprint(item) });
    return Math.min(start.left, end.left) < other.right && Math.max(start.right, end.right) > other.left
      && Math.min(start.front, end.front) < other.back && Math.max(start.back, end.back) > other.front;
  });
  if (!others.length || furnitureSpatial(from).elevationMm !== furnitureSpatial(target).elevationMm) return target;
  const obstacles = others.flatMap(objectSolids).map(bounded), moving = objectSolids(from).map(bounded);
  // Cerca de una mesa/asiento el imán no gira el mueble mientras entra. El giro explícito sigue validándose aparte.
  target = { ...target, rotation: from.rotation };
  const delta = { x: target.x - from.x, y: target.y - from.y };
  let fraction = 1;
  for (const a of moving) for (const b of obstacles) fraction = Math.min(fraction, firstContact(a, b, delta));
  if (fraction === 1) return target;
  fraction = Math.max(0, fraction - .05 / Math.max(1, Math.hypot(delta.x, delta.y)));
  return { ...target, x: from.x + delta.x * fraction, y: from.y + delta.y * fraction };
}
