import { propertyVisitSegmentPrice, type PropertyVisitJob } from './property-visit-job';
import { PROPERTY_VISIT_MAX_SECONDS } from './property-visit-compact';

export const PROPERTY_VISIT_MAX_EUR = 2;
/** Presupuesto del vídeo completo, incluyendo intentos anteriores; nunca un límite separado por clip. */
export function propertyVisitVideoBudget(job: PropertyVisitJob, usdPerEuro: number) {
  if (!Number.isFinite(usdPerEuro) || usdPerEuro <= 0) throw new Error('Falta un cambio EUR/USD verificable.');
  const usd = job.segments.reduce((sum, segment) => sum + propertyVisitSegmentPrice(segment.seconds, job.resolution, job.videoModel) *
    (1 + (segment.attempts?.length ?? 0)), 0);
  return videoGenerationBudget(usd, usdPerEuro);
}

export function videoGenerationBudget(usd: number, usdPerEuro: number) {
  if (!Number.isFinite(usd) || usd < 0 || !Number.isFinite(usdPerEuro) || usdPerEuro <= 0) throw new Error('Presupuesto de vídeo inválido.');
  // Reserva conservadora para diferencias de cambio, cargos e impuestos. Las imágenes tienen presupuesto separado.
  const eurWithReserve = Math.ceil(usd / usdPerEuro * 1.30 * 100) / 100;
  return { usd, eurWithReserve, maxEur: PROPERTY_VISIT_MAX_EUR,
    issue: eurWithReserve > PROPERTY_VISIT_MAX_EUR
      ? `Generación bloqueada: el vídeo completo supera el máximo de ${PROPERTY_VISIT_MAX_EUR} €. Reducir el coste requiere otro planteamiento; dividirlo en tramos no reduce el total.` : null };
}

export function propertyVisitDurationIssue(job: PropertyVisitJob) {
  const seconds = job.segments.reduce((total, segment) => total + segment.seconds, 0);
  return !Number.isFinite(seconds) || seconds <= 0 || seconds > PROPERTY_VISIT_MAX_SECONDS || job.durationMs !== seconds * 1000
    ? 'El paseo debe durar como máximo 60 segundos. Prepara un paseo nuevo; la construcción se genera por separado.' : null;
}
