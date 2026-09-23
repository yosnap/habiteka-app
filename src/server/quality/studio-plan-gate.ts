import 'server-only';

/**
 * Puerta de calidad del ESTUDIO del plano, previa a las vistas de pago.
 *
 * Criterio global de la capa de calidad: ninguna generación de pago parte de un
 * plano por debajo del umbral. Las vistas cenitales del estudio son
 * generaciones de pago (resuelven el adaptador de imagen y cobran), así que
 * pasan por la misma regla que el editor:
 *
 *  - `block`: se corta ANTES de resolver el adaptador, con los motivos; no se
 *    cobra nada.
 *  - `confirm`: hace falta confirmación expresa del usuario, validada aquí (el
 *    cliente nunca decide). Jev caído o sin clave también cae aquí.
 *  - `proceed`: sigue.
 *
 * El veredicto es el que dejó guardado la lectura del plano (`plan_extraction`)
 * en el estado del estudio. Si no hay ninguno guardado pero sí la extracción
 * cruda, se evalúa en el momento con esa evidencia (Jev es barato y no ve la
 * imagen). Si no hay evidencia estructurada ninguna —una foto que nunca se ha
 * leído—, no hay fiabilidad que afirmar: fail-closed, se pide confirmar.
 */
import type { QualityVerdict } from '@/lib/quality-verdict';
import { CONFIRM_HINT } from '@/lib/quality-messages';
import type { StudioState } from '@/lib/studio-state';
import type { OrgContext } from '@/server/auth/org-context';
import { fail } from '@/server/errors/run-action';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { evaluatePlanQuality, importNormalizeOptions } from '@/server/plan/import-plan-from-image';

const UNKNOWN_REASON =
  'No hemos leído la geometría de este plano, así que no podemos medir su fiabilidad.';

/** Veredicto vigente del plano del estudio, sin cortar nada. */
export async function studioPlanQuality(
  ctx: OrgContext,
  projectId: string,
  state: StudioState,
  action: string,
): Promise<QualityVerdict> {
  if (state.quality) return state.quality;

  const planImport = state.planImport;
  if (!planImport) {
    return { score: null, decision: 'confirm', reasons: [UNKNOWN_REASON], failOpen: false };
  }
  // Sin veredicto guardado (importaciones anteriores a la puerta): se evalúa
  // ahora con la extracción cruda, sin volver a llamar al modelo de visión.
  const result = buildPlanImport(planImport.raw, {
    includeFurniture: true,
    normalize: importNormalizeOptions(planImport.detected),
  });
  return evaluatePlanQuality(
    ctx,
    projectId,
    planImport.image,
    { raw: planImport.raw, detected: planImport.detected, result },
    { action },
  );
}

/**
 * Corta la generación si el plano no está en condiciones. Devuelve el veredicto
 * para que quien llama pueda registrarlo o enseñarlo.
 */
export async function assertStudioPlanQuality(
  ctx: OrgContext,
  projectId: string,
  state: StudioState,
  ack: boolean,
  action: string,
): Promise<QualityVerdict> {
  const quality = await studioPlanQuality(ctx, projectId, state, action);
  if (quality.decision === 'block') fail(blockedMessage(quality.reasons));
  if (quality.decision === 'confirm' && ack !== true) fail(confirmMessage(quality.reasons));
  return quality;
}

function blockedMessage(reasons: string[]): string {
  return [
    'Este plano no está en condiciones de generar una vista: no hemos gastado nada.',
    ...bullets(reasons),
    'Llévalo al editor y corrígelo (cierra las estancias, une los muros y revisa las medidas) antes de generar.',
  ].join('\n');
}

function confirmMessage(reasons: string[]): string {
  return [
    'Hay dudas sobre este plano y la generación se ha detenido antes de gastar.',
    ...bullets(reasons),
    CONFIRM_HINT,
  ].join('\n');
}

function bullets(reasons: string[]): string[] {
  return reasons.slice(0, 5).map((reason) => `· ${reason}`);
}
