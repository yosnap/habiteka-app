import 'server-only';

/**
 * Evaluación posterior de una versión creada por ITERACIÓN.
 *
 * Una iteración genera una versión nueva del entregable y se cobra como la
 * entrega inicial, así que se puntúa igual: la referencia es el id de la versión
 * nueva. Reutiliza la evaluación posterior de la entrega (`result-gate`), de modo
 * que las reglas son las mismas: un render sin veredicto del auditor de visión no
 * se puntúa (Jev no ve la imagen), la memoria y el plano sí.
 *
 * Nunca rompe la iteración: el usuario ya tiene su versión nueva y la calidad es
 * información, no una puerta. Todo error —Jev caído, timeout, BD— se traga, y
 * el mismo presupuesto TOTAL de la entrega acota también el contexto que se lee
 * antes de puntuar: la iteración nunca espera por su propia calidad.
 */
import type { Collected, Deliverable, DeliverablePayload } from '@/lib/contracts';
import { prisma } from '@/server/db/prisma';
import type { QualityContext } from './evaluate';
import { evaluateDeliverableResults, RESULT_BUDGET_MS, withBudget } from './result-gate';

export interface IterationResultInput {
  projectId: string;
  /** Id de la versión NUEVA ya persistida: es el `refId` de la evaluación. */
  newDeliverableId: string;
  /** Tipo del contrato (`memoria`, `plano2d`, `render3d`). */
  type: string;
  payload: unknown;
}

/** Puntúa la versión nueva de una iteración. No lanza nunca. */
export async function evaluateIterationResult(
  ctx: QualityContext,
  input: IterationResultInput,
): Promise<void> {
  const deadline = Date.now() + RESULT_BUDGET_MS;
  try {
    const deliverable: Deliverable = {
      id: input.newDeliverableId,
      type: input.type as Deliverable['type'],
      payload: input.payload as DeliverablePayload,
      legalSeal: '',
      version: 0,
    };
    const memoriaContext =
      input.type === 'memoria'
        ? await withBudget(memoriaContextOf(input.projectId), deadline)
        : null;
    await withBudget(
      evaluateDeliverableResults(ctx, {
        projectId: input.projectId,
        deliverables: [deliverable],
        ...(memoriaContext ? { memoriaContext } : {}),
      }),
      deadline,
    );
  } catch {
    // La versión nueva ya está creada y cobrada: puntuarla no puede romperla.
  }
}

/**
 * Estilo y objetivo con los que juzgar la coherencia de una memoria iterada. Se
 * leen del estado del asistente del proyecto; si no hay estado, van vacíos y Jev
 * juzga la memoria por sí misma.
 */
async function memoriaContextOf(projectId: string): Promise<{ estilo: string; objetivo: string }> {
  const rows = await prisma.agentState.findMany({
    where: { projectId },
    select: { collected: true },
  });
  for (const row of rows) {
    const collected = row.collected as unknown as Collected | null;
    if (collected?.estilo) {
      return { estilo: collected.estilo, objetivo: collected.objetivo ?? '' };
    }
  }
  return { estilo: '', objetivo: '' };
}
