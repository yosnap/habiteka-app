import 'server-only';

/**
 * Lectura de la calidad registrada de los entregables, por referencia.
 *
 * «Diseños» enseña la última evaluación posterior de cada entregable. La
 * decisión se recalcula con los umbrales vigentes (el admin puede haberlos
 * cambiado desde que se guardó la fila), igual que hace la caché de evaluación.
 */
import type { QualityVerdict } from '@/lib/quality-verdict';
import { prisma } from '@/server/db/prisma';
import {
  MEMORIA_RESULT_CHECKPOINT,
  PLAN_RESULT_CHECKPOINT,
  RENDER_RESULT_CHECKPOINT,
} from './checkpoints-results';
import { loadThresholds } from './evaluate';
import { decide } from './scoring';

const RESULT_CHECKPOINTS = [
  RENDER_RESULT_CHECKPOINT,
  MEMORIA_RESULT_CHECKPOINT,
  PLAN_RESULT_CHECKPOINT,
];

/** Última evaluación posterior por `refId` (id del entregable). */
export async function latestQualityByRef(
  organizationId: string,
  refIds: string[],
): Promise<Map<string, QualityVerdict>> {
  const byRef = new Map<string, QualityVerdict>();
  if (refIds.length === 0) return byRef;

  const rows = await prisma.aiQualityEvaluation.findMany({
    where: {
      organizationId,
      refId: { in: refIds },
      checkpoint: { in: RESULT_CHECKPOINTS },
    },
    orderBy: { createdAt: 'asc' },
    select: { refId: true, score: true, decision: true, reasons: true, failOpen: true },
  });
  const thresholds = await loadThresholds();

  for (const row of rows) {
    if (!row.refId) continue;
    byRef.set(row.refId, {
      score: row.score,
      decision: row.score === null ? asDecision(row.decision) : decide(row.score, thresholds),
      reasons: Array.isArray(row.reasons) ? (row.reasons as string[]) : [],
      failOpen: row.failOpen,
    });
  }
  return byRef;
}

function asDecision(value: string): QualityVerdict['decision'] {
  return value === 'proceed' || value === 'block' ? value : 'confirm';
}
