/**
 * Catálogo compartido de tiras LED: un único sitio para tipos, etiquetas y
 * valores por defecto, igual que `kitchen-run-types.ts` con los muebles. Lo
 * consumen el panel, la capa 2D y la escena 3D.
 */
import type { LightStrip } from './schema';

export type LightStripKind = LightStrip['kind'];
export const STRIP_KINDS: readonly LightStripKind[] = ['cove', 'under-cabinet', 'free'];

export const STRIP_KIND_LABELS: Record<LightStripKind, string> = {
  cove: 'Foseado perimetral',
  'under-cabinet': 'Bajo módulos altos',
  free: 'Tramo libre',
};

/** Límites del esquema, compartidos por validación, comandos y UI. */
export const MAX_LIGHT_STRIPS = 48;
export const MAX_STRIP_POINTS = 24;
export const MIN_STRIP_POINTS = 2;
/** Dos puntos más cerca que esto describen un tramo que no se puede iluminar. */
export const MIN_STRIP_SEGMENT_MM = 50;
export const MAX_STRIP_LENGTH_MM = 60_000;
export const MAX_STRIP_ELEVATION_MM = 4000;
export const STRIP_TEMPERATURE_RANGE_K = [1800, 6500] as const;
export const STRIP_LUMENS_PER_METER_RANGE = [50, 2000] as const;

/** Valores de partida por tipo; el recorrido lo pone quien crea la tira. */
export const STRIP_DEFAULTS: Record<
  LightStripKind,
  Pick<LightStrip, 'color' | 'temperatureK' | 'lumensPerMeter' | 'elevationMm' | 'derived'>
> = {
  cove: { color: '#ffe6bf', temperatureK: 2700, lumensPerMeter: 600, elevationMm: 2500, derived: true },
  'under-cabinet': { color: '#fff1d8', temperatureK: 3000, lumensPerMeter: 800, elevationMm: 1400, derived: true },
  free: { color: '#ffe6bf', temperatureK: 3000, lumensPerMeter: 600, elevationMm: 2400, derived: false },
};

/** Longitud total del recorrido en milímetros. */
export function stripLengthMm(path: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return total;
}
