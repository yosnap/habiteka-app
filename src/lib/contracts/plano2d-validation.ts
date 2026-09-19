import type { PlanPoint, PlanZone, Plano2dPayload } from './plano2d-payload';

const isPoint = (v: unknown): v is PlanPoint =>
  typeof v === 'object' && v !== null && Number.isFinite((v as PlanPoint).x) && Number.isFinite((v as PlanPoint).y);

/** Zona con geometría utilizable: contorno de al menos tres puntos y paredes con extremos válidos. */
export function isDrawablePlanZone(zone: unknown): zone is PlanZone {
  if (typeof zone !== 'object' || zone === null) return false;
  const z = zone as Partial<PlanZone>;
  return Array.isArray(z.outline) && z.outline.length >= 3 && z.outline.every(isPoint)
    && Array.isArray(z.walls) && z.walls.every((w) => typeof w === 'object' && w !== null && isPoint(w.from) && isPoint(w.to) && Number.isFinite(w.thicknessMm));
}

/** Plano completo y dibujable: todas sus zonas tienen geometría. Un plano vacío o con zonas huecas no lo es. */
export function isDrawablePlano(value: unknown): value is Plano2dPayload {
  if (typeof value !== 'object' || value === null) return false;
  const zones = (value as { zones?: unknown }).zones;
  return Array.isArray(zones) && zones.length > 0 && zones.every(isDrawablePlanZone);
}
