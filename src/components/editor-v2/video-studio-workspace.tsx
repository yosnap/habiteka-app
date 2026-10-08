'use client';

import { useState } from 'react';
import type { EditorScope } from '@/server/editor/authority';
import type { ApprovedDesign, ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { approveEditorDesign, loadCurrentEditorDocument } from '@/server/editor/save-document';
import { ApprovalReviewDialog } from './session/approval-review-dialog';
import { VideoStudio } from './video-studio';

/** Página de medios independiente del canvas y de sus borradores locales. */
export function VideoStudioWorkspace({ scope, projectName, approval: initialApproval, approvalCurrent: initialCurrent, writable }: {
  scope: EditorScope; projectName: string; approval: ApprovedDesign | null; approvalCurrent: boolean; writable: boolean;
}) {
  const [approval, setApproval] = useState(initialApproval);
  const [current, setCurrent] = useState(initialCurrent);
  const [lighting, setLighting] = useState<ApprovedLightingPreset>(initialApproval?.lightingPreset ?? 'daylight');
  const [review, setReview] = useState(false), [pending, setPending] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function openReview() {
    setPending(true); setError(null); setRevision(null); setReview(true);
    try { setRevision((await loadCurrentEditorDocument(scope)).revision); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la revisión.'); }
    finally { setPending(false); }
  }
  async function approve() {
    if (pending || revision === null) return;
    setPending(true); setError(null);
    try {
      setApproval(await approveEditorDesign(scope, revision, lighting));
      setCurrent(true); setReview(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo aprobar. Reabre la revisión para actualizarla.'); }
    finally { setPending(false); }
  }
  return <>
    <VideoStudio scope={scope} projectName={projectName} approval={approval}
      approvalCurrent={current} approvalDisabled={!writable || pending} lighting={lighting}
      onReviewApproval={() => void openReview()} />
    <ApprovalReviewDialog open={review} pending={pending} error={error} lighting={lighting} confirmDisabled={revision === null}
      onLightingChange={setLighting} onClose={() => setReview(false)} onConfirm={() => void approve()} />
  </>;
}
