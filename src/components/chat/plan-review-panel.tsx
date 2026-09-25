'use client';

import { useState } from 'react';
import Link from 'next/link';
import { callAction } from '@/lib/action-result';
import { acceptPlanReviewFix, reviewCurrentPlan } from '@/app/(app)/projects/[id]/_actions/plan-review-actions';
import type { PlanIssueFix } from '@/lib/editor-document/plan-issues';
import type { planReview } from '@/lib/editor-document/plan-review';

type Review = ReturnType<typeof planReview>;

export function PlanReviewPanel({ projectId, zoneId }: { projectId: string; zoneId: string | null }) {
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFix, setConfirmFix] = useState<PlanIssueFix | null>(null);
  const editorUrl = `/projects/${projectId}${zoneId ? `?zona=${encodeURIComponent(zoneId)}` : ''}`;

  const run = async (work: () => Promise<Review>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      setReview(await work());
      setConfirmFix(null);
    } catch (cause) {
      setReview(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo revisar el plano.');
    } finally {
      setPending(false);
    }
  };

  return <section className="border-line bg-surface rounded-card border p-3 text-sm" aria-label="Revisor de plano">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-ink font-semibold">Revisor de plano</h2>
        <p className="text-ink-soft text-xs">Comprueba el documento guardado del Editor v2.</p>
      </div>
      <button type="button" className="border-line rounded-control border px-3 py-1.5" disabled={pending}
        onClick={() => void run(() => callAction(reviewCurrentPlan(projectId, zoneId)))}>
        {pending ? 'Revisando…' : 'Revisa este plano'}
      </button>
    </div>
    {error && <p role="alert" className="text-destructive mt-2">{error}</p>}
    {review && <div className="mt-3 space-y-2">
      <p className="text-ink-soft text-xs">Revisión {review.revision}. Comprueba también las cotas escritas contra el original: esta revisión detecta defectos geométricos medibles, no certifica medidas.</p>
      {review.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-800">
        {review.warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>}
      {review.issues.length ? <ul className="list-disc space-y-1 pl-5">
        {review.issues.map((issue) => <li key={issue.kind}>{issue.message}{issue.ids.length ? ` Elementos: ${issue.ids.join(', ')}.` : ''}</li>)}
      </ul> : review.warnings.length === 0 ? <p role="status">No se detectaron incidencias geométricas de las que comprueba el editor.</p> : null}
      {(review.issues.length > 0 || review.warnings.length > 0) && <Link className="text-ink underline" href={editorUrl}>Abrir el plano para corregir muros, huecos y medidas</Link>}
      {review.proposals.map((proposal) => <div key={proposal.fix} className="border-line rounded-control border p-2">
        <p className="font-medium">Propuesta: {proposal.label}</p>
        <p className="text-ink-soft text-xs">
          {proposal.removedWallIds.length} muros retirados; {proposal.removedOpeningIds.length} huecos retirados; {proposal.removedFloorFinishRoomIds.length} acabados retirados.
          {proposal.removedOpeningIds.length > 0 ? ` Huecos: ${proposal.removedOpeningIds.join(', ')}.` : ''}
        </p>
        {confirmFix === proposal.fix ? <div className="mt-2 flex gap-2">
          <button type="button" className="rounded-control bg-ink px-3 py-1 text-white" disabled={pending}
            onClick={() => void run(() => callAction(acceptPlanReviewFix(projectId, zoneId, review.revision, proposal.fix)))}>Aceptar cambio</button>
          <button type="button" className="border-line rounded-control border px-3 py-1" onClick={() => setConfirmFix(null)}>Cancelar</button>
        </div> : <button type="button" className="border-line mt-2 rounded-control border px-3 py-1" disabled={pending}
          onClick={() => setConfirmFix(proposal.fix)}>Ver y aceptar propuesta</button>}
      </div>)}
    </div>}
  </section>;
}
