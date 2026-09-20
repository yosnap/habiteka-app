/**
 * Reescalado de un plano métrico al ancho REAL indicado por el usuario (el
 * caso: el boceto no traía medidas, la escala inicial era una conjetura y el
 * usuario aporta el dato verdadero). Pura e isomorfa; preserva proporciones y
 * REGENERA las etiquetas de cota, que dejan de valer al cambiar la escala.
 */
import type { PlanDimension, PlanPoint, Plano2dPayload } from '@/lib/contracts';

/** Reescala el plano para que su ancho total (bbox de muros) sea `widthMeters`. */
export function rescalePlanoToWidth(plano: Plano2dPayload, widthMeters: number): Plano2dPayload {
  const walls = plano.zones.flatMap((z) => z.walls);
  if (walls.length === 0 || !Number.isFinite(widthMeters) || widthMeters <= 0) return plano;

  const xs = walls.flatMap((w) => [w.from.x, w.to.x]);
  const width = Math.max(...xs) - Math.min(...xs);
  if (width <= 0) return plano;

  const factor = (widthMeters * 1000) / width;
  const scalePoint = (p: PlanPoint): PlanPoint => ({
    x: Math.round(p.x * factor),
    y: Math.round(p.y * factor),
  });

  return {
    ...plano,
    zones: plano.zones.map((zone) => ({
      ...zone,
      outline: zone.outline.map(scalePoint),
      walls: zone.walls.map((w) => ({ ...w, from: scalePoint(w.from), to: scalePoint(w.to) })),
      apertures: zone.apertures.map((a) => ({ ...a, widthMm: Math.round(a.widthMm * factor) })),
      dimensions: zone.dimensions.map((d) => relabel(d, scalePoint)),
    })),
  };
}

/** Reescala una cota y recalcula su etiqueta con la longitud nueva. */
function relabel(dim: PlanDimension, scalePoint: (p: PlanPoint) => PlanPoint): PlanDimension {
  const from = scalePoint(dim.from);
  const to = scalePoint(dim.to);
  const meters = Math.hypot(to.x - from.x, to.y - from.y) / 1000;
  return { ...dim, from, to, label: `${meters.toFixed(2)} m` };
}
