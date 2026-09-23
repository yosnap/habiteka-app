import 'server-only';

/**
 * Evaluación POSTERIOR a la entrega: puntúa lo que ya se ha generado y cobrado.
 *
 * Nunca rompe la entrega. Se ejecuta después de persistir los entregables (para
 * poder referenciarlos por su id) y todo fallo —Jev caído, timeout, BD— se traga:
 * el usuario ya tiene su diseño y la calidad es información, no una puerta.
 *
 * Los entregables se puntúan EN PARALELO con un presupuesto TOTAL: tres
 * entregables no pueden sumar tres esperas seriadas antes de devolver la
 * entrega. Lo que no llegue a tiempo simplemente no se registra.
 *
 * El plano que ya se puntuó al importarlo (punto de control del plano, fase 2)
 * no se vuelve a pagar: su veredicto viaja dentro del propio payload y se
 * reaprovecha tal cual.
 */
import type { Deliverable } from '@/lib/contracts';
import {
  MEMORIA_RESULT_CHECKPOINT,
  PLAN_RESULT_CHECKPOINT,
  RENDER_RESULT_CHECKPOINT,
} from './checkpoints-results';
import {
  evaluateCheckpoint,
  evaluateCheckpointCached,
  evidenceHashOf,
  recordReusedEvaluation,
  type EvaluationRef,
  type QualityContext,
} from './evaluate';
import {
  buildMemoriaResultEvidence,
  buildPlanResultEvidence,
  buildRenderResultEvidence,
  type RenderAuditVerdict,
} from './evidence/result-evidence';

/**
 * Presupuesto TOTAL de la evaluación posterior de una entrega, no por
 * entregable: Jev tarda menos de un segundo por llamada y la entrega ya está
 * hecha, así que pasado este tiempo se abandona lo que quede pendiente.
 */
export const RESULT_BUDGET_MS = 9_000;

export interface ResultEvaluationInput {
  projectId: string;
  /** Entregables YA persistidos: su `id` es la referencia de la evaluación. */
  deliverables: Deliverable[];
  /** Veredicto del auditor de visión por id de entregable, si el render se auditó. */
  audits?: Map<string, RenderAuditVerdict>;
  /** Contexto de la memoria para juzgar su coherencia. */
  memoriaContext?: { estilo: string; objetivo: string };
}

/**
 * Puntúa cada entregable entregado y registra el resultado con `refId` = id del
 * entregable. No lanza: devuelve el número de evaluaciones registradas.
 */
export async function evaluateDeliverableResults(
  ctx: QualityContext,
  input: ResultEvaluationInput,
): Promise<number> {
  const deadline = Date.now() + RESULT_BUDGET_MS;
  const settled = await Promise.allSettled(
    input.deliverables.map((deliverable) =>
      withBudget(
        evaluateOne(
          ctx,
          { projectId: input.projectId, refId: deliverable.id },
          deliverable,
          input,
        ),
        deadline,
      ),
    ),
  );
  // Un fallo o un vencimiento no se propaga: la entrega ya está hecha y cobrada.
  return settled.filter((item) => item.status === 'fulfilled' && item.value === true).length;
}

async function evaluateOne(
  ctx: QualityContext,
  ref: EvaluationRef,
  deliverable: Deliverable,
  input: ResultEvaluationInput,
): Promise<boolean> {
  const payload = deliverable.payload;

  if (payload.type === 'render3d') {
    const verdict = input.audits?.get(deliverable.id);
    // Sin auditoría de visión no hay veredicto textual que puntuar: Jev no ve la
    // imagen y puntuar la nada daría un número inventado.
    if (!verdict) return false;
    await evaluateCheckpoint(
      ctx,
      RENDER_RESULT_CHECKPOINT,
      // Si hay veredicto es porque el render se auditó contra su contrato.
      buildRenderResultEvidence(verdict, true),
      ref,
    );
    return true;
  }

  if (payload.type === 'memoria') {
    await evaluateCheckpoint(
      ctx,
      MEMORIA_RESULT_CHECKPOINT,
      buildMemoriaResultEvidence(payload.markdown, {
        estilo: input.memoriaContext?.estilo ?? '',
        objetivo: input.memoriaContext?.objetivo ?? '',
      }),
      ref,
    );
    return true;
  }

  if (payload.type === 'plano2d') {
    const evidence = buildPlanResultEvidence(payload.plano);
    const previous = payload.plano.calidad;
    if (previous) {
      // Ya evaluado al leer la planta: se reaprovecha su veredicto sin llamar a Jev.
      await recordReusedEvaluation(
        ctx,
        PLAN_RESULT_CHECKPOINT,
        ref,
        evidenceHashOf(PLAN_RESULT_CHECKPOINT, evidence),
        {
          score: previous.score,
          decision: previous.decision,
          confidence: null,
          reasons: previous.motivos ?? [],
          failOpen: previous.score !== null,
        },
      );
      return true;
    }
    await evaluateCheckpointCached(ctx, PLAN_RESULT_CHECKPOINT, evidence, ref);
    return true;
  }

  return false;
}

/** Corta una promesa al llegar la fecha límite COMPARTIDA de la evaluación. */
export function withBudget<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = Math.max(0, deadline - Date.now());
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error('timeout')), remaining).unref?.();
    }),
  ]);
}
