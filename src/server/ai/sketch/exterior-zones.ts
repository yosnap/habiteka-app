/**
 * Zonas EXTERIORES o semiabiertas (terraza, patio, porche, loggia). No cierran
 * región entre muros —su límite es una línea discontinua o el borde del
 * pavimento—, así que la detección de habitaciones las pierde. Aquí se
 * reconstruyen desde el polígono que el modelo asignó a la estancia marcada
 * como exterior: su caja en mm es la zona, y cada lado de la caja que no
 * coincide con un muro existente pasa a ser un límite OCULTO (recinto lógico
 * sin muro físico, que el editor sabe representar). Puro y sin IA.
 */
import type { ExteriorZone, PlanPoint, PlanWall, PlanZone, PlanImportWarning } from '@/lib/contracts';
import type { SketchRoom } from './sketch-types';

export interface ExteriorScale {
  mmPerUnitX: number;
  mmPerUnitY: number;
}

export interface ExteriorResult {
  exteriors: ExteriorZone[];
  warnings: PlanImportWarning[];
}

// Un lado de la caja se considera "ya con muro" si un muro paralelo está a
// menos de esto y cubre al menos esta fracción del lado.
const WALL_MATCH_MM = 350;
const MIN_COVERAGE = 0.6;
// Lado mínimo de una zona exterior creíble.
const MIN_SIDE_MM = 800;

/** Reconstruye las zonas exteriores del modelo que no quedaron como estancia cerrada. */
export function buildExteriorZones(
  rooms: SketchRoom[],
  scale: ExteriorScale,
  zones: PlanZone[],
  walls: PlanWall[],
): ExteriorResult {
  const exteriors: ExteriorZone[] = [];
  const warnings: PlanImportWarning[] = [];

  rooms.filter((r) => r.exterior === true).forEach((room, index) => {
    const box = polygonBoxMm(room.poligono, scale);
    if (box === null || box.maxX - box.minX < MIN_SIDE_MM || box.maxY - box.minY < MIN_SIDE_MM) {
      warnings.push({
        code: 'zona-exterior-sin-contorno',
        message: `«${room.nombre}» es exterior pero su contorno leído es demasiado pequeño; no se crea.`,
      });
      return;
    }
    // Si una estancia cerrada ya ocupa ese sitio con ese nombre, es la misma zona.
    const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    // Si una estancia ya ocupa ese sitio con ese nombre, es la misma zona: se
    // reutiliza su contorno (y sus lados sin muro siguen necesitando límite).
    const existing = zones.find((z) => z.name === room.nombre && contains(z.outline, center));
    const bounds = existing ? boxOf(existing.outline) : box;
    const outline: PlanPoint[] = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ];
    const hiddenBoundaries = outline
      .map((from, i) => ({ from, to: outline[(i + 1) % outline.length]! }))
      .filter((edge) => !coveredByWall(edge, walls));
    exteriors.push({ id: existing?.id ?? `ext${index}`, name: room.nombre, outline, hiddenBoundaries });
  });

  return { exteriors, warnings };
}

function polygonBoxMm(points: Array<{ x: number; y: number }>, scale: ExteriorScale) {
  if (points.length < 3) return null;
  return {
    minX: Math.round(Math.min(...points.map((p) => p.x)) * scale.mmPerUnitX),
    maxX: Math.round(Math.max(...points.map((p) => p.x)) * scale.mmPerUnitX),
    minY: Math.round(Math.min(...points.map((p) => p.y)) * scale.mmPerUnitY),
    maxY: Math.round(Math.max(...points.map((p) => p.y)) * scale.mmPerUnitY),
  };
}

function boxOf(outline: PlanPoint[]) {
  return {
    minX: Math.min(...outline.map((o) => o.x)),
    maxX: Math.max(...outline.map((o) => o.x)),
    minY: Math.min(...outline.map((o) => o.y)),
    maxY: Math.max(...outline.map((o) => o.y)),
  };
}

function contains(outline: PlanPoint[], p: PlanPoint): boolean {
  if (outline.length < 3) return false;
  const xs = outline.map((o) => o.x);
  const ys = outline.map((o) => o.y);
  return p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys);
}

/** True si un muro paralelo y próximo cubre la mayor parte del lado. */
function coveredByWall(edge: { from: PlanPoint; to: PlanPoint }, walls: PlanWall[]): boolean {
  const horizontal = edge.from.y === edge.to.y;
  const axisValue = horizontal ? edge.from.y : edge.from.x;
  const lo = horizontal ? Math.min(edge.from.x, edge.to.x) : Math.min(edge.from.y, edge.to.y);
  const hi = horizontal ? Math.max(edge.from.x, edge.to.x) : Math.max(edge.from.y, edge.to.y);
  let covered = 0;
  for (const w of walls) {
    const wallHorizontal = w.from.y === w.to.y;
    if (wallHorizontal !== horizontal) continue;
    const wallAxis = horizontal ? w.from.y : w.from.x;
    if (Math.abs(wallAxis - axisValue) > WALL_MATCH_MM) continue;
    const wlo = horizontal ? Math.min(w.from.x, w.to.x) : Math.min(w.from.y, w.to.y);
    const whi = horizontal ? Math.max(w.from.x, w.to.x) : Math.max(w.from.y, w.to.y);
    covered += Math.max(0, Math.min(hi, whi) - Math.max(lo, wlo));
  }
  return hi > lo && covered / (hi - lo) >= MIN_COVERAGE;
}
