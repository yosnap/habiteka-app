/**
 * Evidencia MEDIBLE de una importación de plano, para que Jev juzgue la
 * fidelidad de la copia sin ver la imagen.
 *
 * Función pura: compara lo que se midió en píxeles con lo que leyó el modelo y
 * con lo que quedó en el plano resultante. Solo números y listas cortas — nunca
 * imágenes, base64 ni texto libre del usuario —, porque el coste de Jev es por
 * tokens de entrada y el juicio debe caber en una llamada.
 */
import type { PlanImportResult } from '@/lib/contracts';
import { isDrawablePlanZone } from '@/lib/contracts/plano2d-validation';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

/** Longitud por debajo de la cual un muro no aporta geometría (mm). */
const DEGENERATE_WALL_MM = 10;

export interface PlanEvidence {
  /** Muros medidos en la imagen (píxeles); `null` si no hubo detección. */
  murosRaster: number | null;
  /** Muros leídos por el modelo de visión. */
  murosModelo: number;
  /** Muros del plano resultante. */
  murosPlano: number;
  estanciasLeidas: number;
  zonas: number;
  zonasDibujables: number;
  planoDibujable: boolean;
  escalaEstimada: boolean;
  cotasEscritas: number;
  ajustesAplicados: number;
  /** Desviación que quedó entre cota escrita y medida, en % sobre la escrita. */
  desviacionCotasPct: { max: number; media: number } | null;
  avisosPorTipo: Record<string, number>;
  huecosSinMuro: number;
  murosDegenerados: number;
}

export interface PlanEvidenceInput {
  raw: RawSketch;
  detected: DetectedWalls | null;
  result: PlanImportResult;
}

/** Construye la evidencia que se manda a Jev para el punto de control del plano. */
export function buildPlanEvidence({ raw, detected, result }: PlanEvidenceInput): PlanEvidence {
  const zones = result.plano.zones ?? [];
  const walls = zones.flatMap((zone) => zone.walls);
  const murosRaster = detected ? detected.walls.length : null;
  const murosModelo = raw.muros.length;

  return {
    murosRaster,
    murosModelo,
    murosPlano: walls.length,
    estanciasLeidas: raw.habitaciones.length,
    zonas: zones.length,
    zonasDibujables: zones.filter((zone) => isDrawablePlanZone(zone)).length,
    planoDibujable: zones.length > 0 && zones.every((zone) => isDrawablePlanZone(zone)),
    escalaEstimada: result.escalaEstimada,
    cotasEscritas: result.writtenDimensions.filter(
      (w) => w.widthMm !== undefined || w.heightMm !== undefined,
    ).length,
    ajustesAplicados: result.corrections.length,
    desviacionCotasPct: deviation(result),
    avisosPorTipo: countBy(result.warnings.map((w) => w.code)),
    huecosSinMuro: aperturesWithoutWall(zones),
    murosDegenerados: walls.filter(isDegenerate).length,
  };
}

/** Desviación residual de las cotas escritas tras el ajuste, en porcentaje. */
function deviation(result: PlanImportResult): { max: number; media: number } | null {
  const values = result.corrections
    .filter((c) => c.expectedMm > 0)
    .map((c) => (Math.abs(c.residualMm) / c.expectedMm) * 100);
  if (values.length === 0) return null;
  return {
    max: round(Math.max(...values), 1),
    media: round(values.reduce((sum, v) => sum + v, 0) / values.length, 1),
  };
}

/** Aberturas ancladas a un muro que no existe en su zona (hueco sin muro válido). */
function aperturesWithoutWall(zones: PlanImportResult['plano']['zones']): number {
  let orphans = 0;
  for (const zone of zones) {
    const ids = new Set(zone.walls.map((wall) => wall.id));
    orphans += zone.apertures.filter((aperture) => !ids.has(aperture.wallId)).length;
  }
  return orphans;
}

function isDegenerate(wall: { from: { x: number; y: number }; to: { x: number; y: number } }): boolean {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  return Math.hypot(dx, dy) < DEGENERATE_WALL_MM;
}

function countBy(codes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const code of codes) out[code] = (out[code] ?? 0) + 1;
  return out;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
