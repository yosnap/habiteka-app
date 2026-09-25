'use client';

import { useEffect, useState } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { acquireDraftBranch } from '@/canvas/editor-v2/draft-branch';
import { draftKey, type DraftScope, type EditorDraft } from '@/canvas/editor-v2/draft-contract';
import { indexedDbDraftStorage, listScopeDrafts, openAuthorizedDrafts } from '@/canvas/editor-v2/draft-storage';
import { checkEditorSession } from '@/server/editor/check-session';
import { EditorSession } from './editor-session';
import type { AutoGenerateRequest } from '../auto-generate-request';
import type { PlanReference } from '@/lib/editor-document/plan-reference';

export function DurableEditor({ scope, projectName, initial, autoGenerate, reference }: {
  scope: DraftScope; projectName: string; initial: EditorDocument;
  autoGenerate?: AutoGenerateRequest | null;
  reference?: PlanReference | null;
}) {
  const [ready, setReady] = useState<{ scope: DraftScope; recovered?: EditorDraft } | null>(null);
  const [choices, setChoices] = useState<{ scope: DraftScope; drafts: EditorDraft[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Borrador cuyo descarte espera confirmación; un segundo clic lo elimina del almacenamiento local de este navegador.
  const [discarding, setDiscarding] = useState<string | null>(null);
  const discard = async (draft: EditorDraft) => {
    if (!choices) return;
    if (discarding !== draft.key) { setDiscarding(draft.key); return; }
    try { await indexedDbDraftStorage.remove(draft.scope); }
    catch { setError('No se pudo descartar el borrador. Revisa los permisos del navegador.'); return; }
    const drafts = choices.drafts.filter((item) => item.key !== draft.key);
    setDiscarding(null);
    if (drafts.length) setChoices({ ...choices, drafts }); else { setChoices(null); setReady({ scope: choices.scope }); }
  };
  useEffect(() => {
    let disposed = false, release: (() => void) | undefined;
    void (async () => {
      try {
        const branch = await acquireDraftBranch(scope);
        if (disposed) { branch.release(); return; }
        release = branch.release;
        const accessEpoch = await openAuthorizedDrafts(scope.userId, () => checkEditorSession(scope));
        const target = { ...scope, branchId: branch.branchId, accessEpoch };
        const own = await indexedDbDraftStorage.read(target);
        if (disposed) return;
        if (own) { setReady({ scope: target, recovered: own }); return; }
        const available = await listScopeDrafts(scope);
        if (disposed) return;
        if (available.invalid) setError('Hay un borrador que no se puede leer. Se conserva sin modificar para recuperación manual.');
        const drafts = available.drafts.filter((d) => d.inFlight || d.sequence > (d.remoteSequence ?? 0));
        if (drafts.length) setChoices({ scope: target, drafts });
        else setReady({ scope: target });
      } catch {
        if (!disposed) setError('No se puede abrir el almacenamiento local. Revisa los permisos del navegador; no se ha borrado ningún borrador.');
      }
    })();
    return () => { disposed = true; release?.(); };
  }, [scope]);
  return <>
    {error && <p role="alert" className="bg-amber-100 p-4 text-amber-950">{error}</p>}
    {!ready && !choices && !error && <p role="status" className="p-6">Recuperando el espacio de trabajo…</p>}
    {choices && !ready && <section className="space-y-3 p-6">
      <h1 className="text-lg font-semibold">Hay borradores sin sincronizar de este plano</h1>
      <p>Elige el que quieres continuar. Los demás se conservan hasta que los descartes o los guardes en el servidor.</p>
      {choices.drafts.map((draft) => <div key={draft.key} className="flex flex-wrap items-center gap-3">
        <button className="rounded border px-4 py-2" onClick={() => {
          setReady({ scope: choices.scope, recovered: { ...draft, key: draftKey(choices.scope), scope: choices.scope } });
        }}>Recuperar · {new Date(draft.updatedAt).toLocaleString('es-ES')} · {draft.sequence} cambios</button>
        <button className="rounded border border-red-300 px-4 py-2 text-red-800" onClick={() => void discard(draft)}>
          {discarding === draft.key ? 'Confirmar: descartar este borrador' : 'Descartar'}
        </button>
      </div>)}
      <button className="block rounded border px-4 py-2" onClick={() => setReady({ scope: choices.scope })}>
        Abrir la revisión del servidor sin borrar los borradores
      </button>
    </section>}
    {ready && <EditorSession scope={ready.scope} initial={initial} recovered={ready.recovered} projectName={projectName} autoGenerate={autoGenerate ?? null} reference={reference} />}
  </>;
}
