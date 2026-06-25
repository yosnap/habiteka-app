/**
 * Proyección del plano 2D estructurado (en milímetros) a primitivas dibujables
 * en el stage (en píxeles). Lógica pura, sin Konva, para poder probarla aislada:
 * el visor solo consume estas primitivas y las pinta.
 *
 * El plano se escala para encajar en el área disponible manteniendo proporción y
 * se centra; las paredes se convierten en segmentos y las aperturas en marcas.
 */
import type { Plano2dPayload, PlanPoint } from '@/lib/contracts';

export interface KonvaSegment {
  points: number[];
  strokeWidth: number;
}

export interface PlanPrimitives {
  walls: KonvaSegment[];
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
  for (const zone of plano.zones) {
    for (const wall of zone.walls) {
      const [x1, y1] = project(wall.from);
      const [x2, y2] = project(wall.to);
      walls.push({
        points: [x1!, y1!, x2!, y2!],
        strokeWidth: Math.max(1, wall.thicknessMm * scale),
      });
    }
  }
  return { walls, scale, offsetX, offsetY };
}

function computeBounds(plano: Plano2dPayload) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const zone of plano.zones) {
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
