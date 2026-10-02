'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction, fail } from '@/server/errors/run-action';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { applyPlanReviewFix, planReview } from '@/lib/editor-document/plan-review';
import type { PlanIssueFix } from '@/lib/editor-document/plan-issues';

function scope(projectId: string, zoneId: string | null) {
  return { projectId, zoneId };
}

/** Revisa la cabeza guardada del Editor v2; no genera imágenes ni modifica datos. */
export async function reviewCurrentPlan(projectId: string, zoneId: string | null = null) {
  return runAction(async () => {
    const current = await withEditorDocuments(await requireOrgContext()).load(scope(projectId, zoneId));
    if (current.authority !== 'v2') fail('Envía primero el plano al Editor v2 para revisarlo.');
    return planReview(current.document);
  });
}

/** Una propuesta aceptada se vuelve a calcular sobre la misma revisión antes de guardar. */
export async function acceptPlanReviewFix(
  projectId: string,
  zoneId: string | null,
  expectedRevision: number,
  fix: PlanIssueFix,
) {
  return runAction(async () => {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      fail('Revisión de plano inválida.');
    if (fix !== 'collapse-degenerate-walls' && fix !== 'prune-orphan-floor-finishes')
      fail('Corrección de plano inválida.');
    const repo = withEditorDocuments(await requireOrgContext());
    const target = scope(projectId, zoneId);
    const current = await repo.load(target);
    if (current.authority !== 'v2' || !current.writable)
      fail('El plano no está disponible para editar.');
    if (current.document.revision !== expectedRevision)
      fail('El plano cambió desde la revisión. Vuelve a revisarlo antes de aceptar.');
    const review = planReview(current.document);
    if (!review.proposals.some((proposal) => proposal.fix === fix))
      fail('Esta corrección ya no corresponde al plano actual.');
    const document = applyPlanReviewFix(current.document, fix);
    const saved = await repo.save(target, {
      document,
      expectedRevision,
      requestKey: `plan-review:${expectedRevision}:${fix}`,
    });
    if (saved.status === 'conflict')
      fail('El plano cambió mientras se guardaba. Vuelve a revisarlo.');
    return planReview(saved.document);
  });
}
