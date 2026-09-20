/**
 * Sentido de apertura de una puerta a partir de las estancias del plano: la
 * hoja bate hacia la estancia a la que se entra (no hacia el pasillo) y, en
 * una puerta exterior, hacia dentro de la casa. Entre dos estancias que no son
 * de paso, hacia la más pequeña. Devuelve el lado en la convención del editor:
 * `left` = normal positiva (-dy, dx) del muro orientado de `from` a `to`.
 */
import type { PlanAperture, PlanPoint, PlanWall, PlanZone } from '@/lib/contracts';
import { add, direction, lerp, normal, polygonArea } from './svg-geometry';

const CIRCULATION = /pasillo|distribuidor|recibidor|entrada|vest[ií]bulo|hall|corredor/i;
// Distancia (mm) desde el eje del muro a la que se sondea cada lado.
const PROBE_MM = 350;

export type DoorSwing = 'left' | 'right';

export function doorSwing(aperture: PlanAperture, wall: PlanWall, zones: PlanZone[]): DoorSwing {
  const dir = direction(wall.from, wall.to);
  if (!dir) return 'left';
  const n = normal(dir);
  const center = lerp(wall.from, wall.to, aperture.position);
  const probe = wall.thicknessMm / 2 + PROBE_MM;
  const left = zoneAt(add(center, n, probe), zones);
  const right = zoneAt(add(center, n, -probe), zones);
  if (left && !right) return 'left';
  if (right && !left) return 'right';
  if (!left || !right) return 'left';
  const leftCirculation = CIRCULATION.test(left.name);
  const rightCirculation = CIRCULATION.test(right.name);
  if (leftCirculation !== rightCirculation) return leftCirculation ? 'right' : 'left';
  return Math.abs(polygonArea(left.outline)) <= Math.abs(polygonArea(right.outline)) ? 'left' : 'right';
}

function zoneAt(p: PlanPoint, zones: PlanZone[]): PlanZone | null {
  for (const zone of zones) if (zone.outline.length >= 3 && pointInPolygon(p, zone.outline)) return zone;
  return null;
}

function pointInPolygon(p: PlanPoint, polygon: PlanPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
