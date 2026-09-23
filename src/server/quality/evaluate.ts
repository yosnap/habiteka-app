import 'server-only';

/**
 * Evaluación de calidad de un punto de control.
 *
 * Construye las preguntas del punto de control con la evidencia, las manda a Jev
 * en una sola llamada, combina las respuestas en un score 0–100 y lo traduce a
 * una decisión por bandas (ajustables en el panel de admin).
 *
 * Política de fallo: **fail-closed para lo caro**. Si no hay clave o Jev falla,
 * nunca se devuelve `proceed`; se devuelve `confirm` (confirmación expresa del
 * usuario) y se registra con `failOpen=false` y el código de error. El coste de
 * Jev lo absorbe la plataforma: no toca los créditos del usuario.
 */
import { createHash } from 'node:crypto';
import { prisma } from '@/server/db/prisma';
import { AiError } from '@/server/ai/errors';
import type { OrgContext } from '@/server/auth/org-context';
import { getCheckpoint } from './checkpoints';
import { withGateMark, type GateContext, type GateMark } from './gate-mark';
import { askJev, type JevQuestion, type JevResult } from './jev-client';
import {
  combineAnswers,
  decide,
  parseThresholds,
  type QualityDecision,
  type QualityThresholds,
} from './scoring';

export const QUALITY_THRESHOLDS_KEY = 'quality_thresholds';

const UNAVAILABLE_REASON =
  'No se pudo evaluar la calidad con Jev; confirma antes de seguir para no gastar de más.';

/** Lo mínimo para atribuir una evaluación: no hace falta el rol del miembro. */
export type QualityContext = Pick<OrgContext, 'organizationId' | 'userId'>;

export interface EvaluationRef {
  refId?: string | null;
  projectId?: string | null;
}

export interface QualityEvaluation {
  score: number | null;
  decision: QualityDecision;
  confidence: number | null;
  reasons: string[];
  /** `false` cuando la decisión sale de la política de fallo, no de Jev. */
  failOpen: boolean;
}

/**
 * Evalúa un punto de control con su evidencia y registra el resultado.
 *
 * Con `gate`, la fila queda marcada como paso de puerta de una acción de pago
 * concreta: `cut` si la decisión la cortó, `passed` si la dejó pasar. Sin `gate`
 * la evaluación es informativa (una tarjeta en la UI) y no cuenta como ahorro.
 */
export async function evaluateCheckpoint<E>(
  ctx: QualityContext,
  checkpointId: string,
  evidence: E,
  ref: EvaluationRef = {},
  gate?: GateContext,
): Promise<QualityEvaluation> {
  const definition = getCheckpoint(checkpointId);
  if (!definition) {
    throw new Error(`Punto de control desconocido: ${checkpointId}`);
  }

  const state = definition.buildState(evidence as never);
  const evidenceHash = createHash('sha256').update(state).digest('hex');
  const questions = buildQuestions(definition.questions, evidence);

  let result: JevResult;
  try {
    result = await askJev(state, questions);
  } catch (error) {
    const evaluation = unavailable();
    await record(
      ctx,
      checkpointId,
      ref,
      evidenceHash,
      evaluation,
      null,
      errorCode(error),
      markOf(gate, evaluation),
    );
    return evaluation;
  }

  const thresholds = await loadThresholds();
  const combined = combineAnswers(definition, questions, result.answers);
  const evaluation: QualityEvaluation =
    combined.score === null
      ? unavailable()
      : explained(definition, evidence, {
          score: combined.score,
          decision: decide(combined.score, thresholds),
          confidence: combined.confidence,
          reasons: combined.reasons,
          failOpen: true,
        });
  await record(
    ctx,
    checkpointId,
    ref,
    evidenceHash,
    evaluation,
    result,
    combined.score === null ? 'schema' : null,
    markOf(gate, evaluation),
  );
  return evaluation;
}

/** Marca de puerta de una decisión: solo `block` corta el gasto. */
function markOf(
  gate: GateContext | undefined,
  evaluation: QualityEvaluation,
  reused = false,
): GateMark | null {
  if (!gate) return null;
  return {
    gate: evaluation.decision === 'block' ? 'cut' : 'passed',
    action: gate.action,
    ...(reused ? { reused: true } : {}),
  };
}

/**
 * Como `evaluateCheckpoint`, pero reutiliza la última evaluación válida de la
 * misma evidencia: un documento que no ha cambiado no se vuelve a pagar. Solo
 * se reutilizan los veredictos que vienen de Jev (`failOpen`); una decisión de
 * la política de fallo se reintenta, porque el corte pudo ser momentáneo.
 *
 * Política única de registro: acertar en caché NO deja el paso sin rastro. Se
 * registra una fila con coste 0 y marca de reutilización, de modo que cada paso
 * de puerta quede trazado y el panel pueda contar decisiones sin inflar el
 * coste de Jev (solo las llamadas reales tienen coste).
 */
export async function evaluateCheckpointCached<E>(
  ctx: QualityContext,
  checkpointId: string,
  evidence: E,
  ref: EvaluationRef = {},
  gate?: GateContext,
): Promise<QualityEvaluation> {
  const definition = getCheckpoint(checkpointId);
  if (!definition) {
    throw new Error(`Punto de control desconocido: ${checkpointId}`);
  }
  const evidenceHash = createHash('sha256')
    .update(definition.buildState(evidence as never))
    .digest('hex');
  const cached = await prisma.aiQualityEvaluation.findFirst({
    where: {
      organizationId: ctx.organizationId,
      checkpoint: checkpointId,
      evidenceHash,
      failOpen: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (cached && cached.score !== null) {
    // La decisión se recalcula: los umbrales pueden haber cambiado en el admin
    // desde que se guardó esta evaluación.
    const evaluation = explained(definition, evidence, {
      score: cached.score,
      decision: decide(cached.score, await loadThresholds()),
      confidence: cached.confidence,
      reasons: Array.isArray(cached.reasons) ? (cached.reasons as string[]) : [],
      failOpen: true,
    });
    await record(
      ctx,
      checkpointId,
      ref,
      evidenceHash,
      evaluation,
      null,
      null,
      markOf(gate, evaluation, true) ?? { gate: 'info', action: 'informativa', reused: true },
    );
    return evaluation;
  }
  return evaluateCheckpoint(ctx, checkpointId, evidence, ref, gate);
}

/**
 * Registra una evaluación YA obtenida en otro punto de control, sin volver a
 * llamar a Jev. Lo usa la evaluación posterior a la entrega cuando el plano ya
 * se puntuó al importarlo: se reaprovecha su veredicto con el `evidenceHash` de
 * origen, de modo que el panel de eficacia no cuente dos veces el mismo coste.
 */
export async function recordReusedEvaluation(
  ctx: QualityContext,
  checkpointId: string,
  ref: EvaluationRef,
  evidenceHash: string,
  evaluation: QualityEvaluation,
  mark: GateMark | null = { gate: 'info', action: 'informativa', reused: true },
): Promise<void> {
  await record(ctx, checkpointId, ref, evidenceHash, evaluation, null, null, mark);
}

/** Hash estable de la evidencia de un punto de control (misma regla que al evaluar). */
export function evidenceHashOf<E>(checkpointId: string, evidence: E): string {
  const definition = getCheckpoint(checkpointId);
  if (!definition) throw new Error(`Punto de control desconocido: ${checkpointId}`);
  return createHash('sha256').update(definition.buildState(evidence as never)).digest('hex');
}

/** Umbrales vigentes; el admin los cambia sin desplegar. */
export async function loadThresholds(): Promise<QualityThresholds> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: QUALITY_THRESHOLDS_KEY },
  });
  return parseThresholds(setting?.value);
}

/**
 * Añade los hechos medidos que explican una fiabilidad que no es alta. Se
 * aplica también al reutilizar la caché: las filas antiguas no los traían.
 */
function explained<E>(
  definition: { explain?: (evidence: never) => string[] },
  evidence: E,
  evaluation: QualityEvaluation,
): QualityEvaluation {
  if (evaluation.decision === 'proceed' || !definition.explain) return evaluation;
  const facts = definition.explain(evidence as never);
  return { ...evaluation, reasons: [...new Set([...evaluation.reasons, ...facts])] };
}

function unavailable(): QualityEvaluation {
  return {
    score: null,
    decision: 'confirm',
    confidence: null,
    reasons: [UNAVAILABLE_REASON],
    failOpen: false,
  };
}

function buildQuestions<E>(
  specs: Record<string, { build: (evidence: never) => JevQuestion; applies?: (evidence: never) => boolean }>,
  evidence: E,
): Record<string, JevQuestion> {
  return Object.fromEntries(
    Object.entries(specs)
      .filter(([, spec]) => spec.applies?.(evidence as never) ?? true)
      .map(([id, spec]) => [id, spec.build(evidence as never)]),
  );
}

function errorCode(error: unknown): string {
  if (error instanceof AiError) return error.kind;
  return 'unknown';
}

async function record(
  ctx: QualityContext,
  checkpoint: string,
  ref: EvaluationRef,
  evidenceHash: string,
  evaluation: QualityEvaluation,
  result: JevResult | null,
  errorCodeValue: string | null,
  mark: GateMark | null = null,
): Promise<void> {
  await prisma.aiQualityEvaluation.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      projectId: ref.projectId ?? null,
      checkpoint,
      refId: ref.refId ?? null,
      score: evaluation.score,
      decision: evaluation.decision,
      confidence: evaluation.confidence,
      answers: withGateMark((result?.answers ?? {}) as Record<string, unknown>, mark) as object,
      reasons: evaluation.reasons,
      evidenceHash,
      jevModel: result?.model ?? null,
      inputTokens: result?.inputTokens ?? null,
      costUsd: (result?.costUsd ?? 0).toFixed(8),
      failOpen: evaluation.failOpen,
      errorCode: errorCodeValue,
    },
  });
}
