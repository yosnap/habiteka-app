'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { listScopeDrafts, type DraftScope } from '@/canvas/editor-v2/draft-storage';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { restoreEditorRevision } from '@/server/editor/save-document';
import type { EditorScope } from '@/server/editor/authority';
import { EditorSceneView } from '../scene/editor-scene-view';

export function RevisionPreview({ scope, draftScope, document, sourceRevision, headRevision }: {
  scope: EditorScope; draftScope: DraftScope; document: EditorDocument; sourceRevision: number; headRevision: number;
}) {
  const router = useRouter();
  const [store] = useState(() => {
    const value = createEditorStore(document, { readOnly: true });
    value.setState({ document: structuredClone(document) });
    return value;
  });
  const [presentation, setPresentation] = useState<'plan' | 'spatial'>('plan');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async () => {
    setBusy(true); setError(null);
    try {
      const local = await listScopeDrafts(draftScope);
      if (local.invalid || local.drafts.some((draft) => draft.inFlight || draft.sequence > (draft.remoteSequence ?? 0))) {
        setError('Hay borradores locales sin sincronizar en este plano. Ábrelos desde el editor y guárdalos o descártalos antes de recuperar otra versión. No se ha modificado ninguna revisión.');
        return;
      }
      const result = await restoreEditorRevision(scope, sourceRevision, headRevision, true);
      if (result.status === 'conflict') {
        setError(`El plano cambió a la revisión ${result.revision}. Recarga el historial antes de recuperarlo.`);
        return;
      }
      const query = scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : '';
      router.push(`/projects/${encodeURIComponent(scope.projectId)}${query}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo recuperar la revisión.');
    } finally { setBusy(false); }
  };

  return <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white lg:sticky lg:top-4 lg:self-start">
    <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
      <strong className="mr-auto">Vista previa · revisión {sourceRevision}</strong>
      <button type="button" aria-pressed={presentation === 'plan'} className="rounded border px-3 py-1.5" onClick={() => setPresentation('plan')}>Plano visual</button>
      <button type="button" aria-pressed={presentation === 'spatial'} className="rounded border px-3 py-1.5" onClick={() => setPresentation('spatial')}>3D</button>
    </div>
    <div className="h-[520px] min-w-0"><EditorSceneView key={presentation} store={store}
      presentation={presentation} allowVideoExport={false} lightingLocked showNotices={false}
      readOnlyLabel="Vista previa de esta revisión · misma escena 3D" /></div>
    <div className="space-y-2 border-t p-3 text-sm">
      {sourceRevision === headRevision ? <p>Esta es la revisión actual.</p> : <>
        <p>La recuperación creará la revisión {headRevision + 1}. La revisión {headRevision} seguirá disponible en este historial.</p>
        {confirming ? <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded bg-emerald-800 px-3 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => void restore()}>
            {busy ? 'Recuperando…' : `Confirmar recuperación de la revisión ${sourceRevision}`}
          </button>
          <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button>
        </div> : <button type="button" className="rounded border border-emerald-700 px-3 py-2 text-emerald-900" onClick={() => setConfirming(true)}>
          Recuperar esta versión
        </button>}
      </>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  </section>;
}
