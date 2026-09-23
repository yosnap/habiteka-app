/**
 * Proyección del plano 2D estructurado (en milímetros) a primitivas dibujables
 * en el stage (en píxeles). Lógica pura, sin Konva, para poder probarla aislada:
 * el visor solo consume estas primitivas y las pinta.
 *
 * El plano se escala para encajar en el área disponible manteniendo proporción y
 * se centra; las paredes se convierten en segmentos y las aperturas en marcas.
 */
import type { Plano2dPayload, PlanPoint } from '@/lib/contracts';
import { isDrawablePlanZone } from '@/lib/contracts/plano2d-validation';

export interface KonvaSegment {
  points: number[];
  strokeWidth: number;
}

/** Hueco sobre su muro: un tramo del muro que se pinta como puerta o ventana. */
export interface KonvaAperture extends KonvaSegment {
  kind: 'puerta' | 'ventana' | 'hueco';
}

/** Rótulo de una estancia, centrado en su contorno. */
export interface KonvaLabel {
  text: string;
  x: number;
  y: number;
}

export interface PlanPrimitives {
  walls: KonvaSegment[];
  apertures: KonvaAperture[];
  labels: KonvaLabel[];
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function planToPrimitives(
  plano: Plano2dPayload,
  area: { width: number; height: number },
): PlanPrimitives {
  const bounds = computeBounds(plano);
  const planW = Math.max(1, bounds.maxX - bounds.minX);
  const planH = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(area.width / planW, area.height / planH);

  const offsetX = (area.width - planW * scale) / 2 - bounds.minX * scale;
  const offsetY = (area.height - planH * scale) / 2 - bounds.minY * scale;

  const project = (p: PlanPoint) => [p.x * scale + offsetX, p.y * scale + offsetY];

  const walls: KonvaSegment[] = [];
  const apertures: KonvaAperture[] = [];
  const labels: KonvaLabel[] = [];
  // Muros de TODAS las estancias: un hueco puede apoyarse en un muro compartido que
  // figure en otra zona.
  const byId = new Map(drawableZones(plano).flatMap((z) => z.walls.map((w) => [w.id, w] as const)));
  for (const zone of drawableZones(plano)) {
    for (const wall of zone.walls) {
      const [x1, y1] = project(wall.from);
      const [x2, y2] = project(wall.to);
      walls.push({
        points: [x1!, y1!, x2!, y2!],
        strokeWidth: Math.max(1, wall.thicknessMm * scale),
      });
    }
    for (const aperture of Array.isArray(zone.apertures) ? zone.apertures : []) {
      const wall = byId.get(aperture.wallId);
      if (!wall || !Number.isFinite(aperture.position) || !Number.isFinite(aperture.widthMm)) continue;
      const dx = wall.to.x - wall.from.x;
      const dy = wall.to.y - wall.from.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      // Tramo centrado en `position`, recortado a los extremos del muro.
      const half = Math.min(aperture.widthMm, length) / 2 / length;
      const center = Math.min(Math.max(aperture.position, half), 1 - half);
      const at = (t: number) => project({ x: wall.from.x + dx * t, y: wall.from.y + dy * t });
      const [ax, ay] = at(center - half);
      const [bx, by] = at(center + half);
      apertures.push({
        kind: aperture.kind,
        points: [ax!, ay!, bx!, by!],
        strokeWidth: Math.max(2, wall.thicknessMm * scale + 1),
      });
    }
    if (zone.name?.trim()) {
      const cx = zone.outline.reduce((sum, p) => sum + p.x, 0) / zone.outline.length;
      const cy = zone.outline.reduce((sum, p) => sum + p.y, 0) / zone.outline.length;
      const [lx, ly] = project({ x: cx, y: cy });
      labels.push({ text: zone.name.trim(), x: lx!, y: ly! });
    }
  }
  return { walls, apertures, labels, scale, offsetX, offsetY };
}

/** Un entregable antiguo o mal generado puede traer zonas sin geometría: se omiten en vez de romper el visor. */
export function drawableZones(plano: Plano2dPayload) {
  return (Array.isArray(plano?.zones) ? plano.zones : []).filter(isDrawablePlanZone);
}

function computeBounds(plano: Plano2dPayload) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const zone of drawableZones(plano)) {
    for (const p of zone.outline) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  // Plano vacío: bounds neutros para no producir NaN.
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}
