/**
 * Qué clase de imagen ha subido el usuario: un plano en planta o una foto.
 *
 * Importa porque el render por imagen (img2img) solo da un resultado creíble
 * partiendo de una foto, que ya trae perspectiva; partiendo de un plano en
 * planta el modelo devuelve una maqueta isométrica con los muros reinventados.
 * Detectarlo al subir permite mandar el plano a su ruta (convertirlo al editor)
 * antes de gastar una generación.
 *
 * La clasificación la da el mismo análisis de visión que ya se paga (un campo
 * más en su salida estructurada, sin llamada extra). El barrido ráster de muros
 * solo desempata cuando la visión no se moja: la visión ve mucho mejor que un
 * contador de bandas oscuras, así que nunca la contradice.
 */
import type { SketchWall } from '@/server/ai/sketch/sketch-types';

export const IMAGE_KINDS = ['floor_plan', 'room_photo', 'other'] as const;
export type ImageKindValue = (typeof IMAGE_KINDS)[number];

/** Un plano dibuja el contorno completo: pocos tramos no bastan. */
const MIN_PLAN_WALLS = 6;
/** Tramos que cruzan buena parte de la hoja: las fachadas del contorno. */
const LONG_RUN_RATIO = 0.4;
const MIN_LONG_RUNS = 2;

/** Valida el valor que devuelve el modelo; cualquier cosa rara es `other`. */
export function toImageKind(value: unknown): ImageKindValue {
  return IMAGE_KINDS.includes(value as ImageKindValue) ? (value as ImageKindValue) : 'other';
}

/**
 * ¿El barrido ráster ve la retícula de un plano? Muchos tramos rectos y al
 * menos un par que recorren la hoja de lado a lado.
 */
export function rasterLooksLikePlan(walls: SketchWall[]): boolean {
  if (walls.length < MIN_PLAN_WALLS) return false;
  const longRuns = walls.filter(
    (wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= LONG_RUN_RATIO,
  ).length;
  return longRuns >= MIN_LONG_RUNS;
}

/**
 * Veredicto final. El ráster solo puede ascender un `other` a plano: si la
 * visión ha dicho «foto» o «plano», manda ella.
 */
export function classifyImageKind(
  vision: ImageKindValue,
  raster: { looksLikePlan: boolean } | null,
): ImageKindValue {
  if (vision !== 'other') return vision;
  return raster?.looksLikePlan ? 'floor_plan' : 'other';
}
