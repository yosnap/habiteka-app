/**
 * Veredicto de fiabilidad que viaja del servidor a la UI.
 *
 * Vive en `lib` (sin dependencias de servidor) porque lo consumen tanto las
 * Server Actions como los componentes de cliente que enseñan la tarjeta de
 * calidad del plano y la del editor.
 */

/** Decisión de la puerta de calidad sobre un punto de control (evaluado con Jev). */
export type QualityDecisionValue = 'proceed' | 'confirm' | 'block';

/**
 * Porcentaje (o `null` si no se pudo evaluar), decisión por bandas y motivos en
 * español. `failOpen=false` significa que la decisión sale de la política de
 * fallo —Jev caído o sin clave—, no de una evaluación real.
 */
export interface QualityVerdict {
  score: number | null;
  decision: QualityDecisionValue;
  reasons: string[];
  failOpen: boolean;
}
