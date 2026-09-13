'use client';

import { useEffect, useState } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { acquireDraftBranch } from '@/canvas/editor-v2/draft-branch';
import { draftKey, type DraftScope, type EditorDraft } from '@/canvas/editor-v2/draft-contract';
import { indexedDbDraftStorage, listScopeDrafts, openAuthorizedDrafts } from '@/canvas/editor-v2/draft-storage';
import { checkEditorSession } from '@/server/editor/check-session';
import { EditorSession } from './editor-session';

export function DurableEditor({ scope, projectName, initial }: {
  scope: DraftScope; projectName: string; initial: EditorDocument;
}) {
  const [ready, setReady] = useState<{ scope: DraftScope; recovered?: EditorDraft } | null>(null);
  const [choices, setChoices] = useState<{ scope: DraftScope; drafts: EditorDraft[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      <p>Elige el que quieres continuar. Las otras pestañas y borradores se conservarán.</p>
      {choices.drafts.map((draft) => <button key={draft.key} className="mr-3 rounded border px-4 py-2" onClick={() => {
        setReady({ scope: choices.scope, recovered: { ...draft, key: draftKey(choices.scope), scope: choices.scope } });
      }}>Recuperar · {new Date(draft.updatedAt).toLocaleString('es-ES')} · {draft.sequence} cambios</button>)}
      <button className="block rounded border px-4 py-2" onClick={() => setReady({ scope: choices.scope })}>
        Abrir la revisión del servidor sin borrar los borradores
      </button>
    </section>}
    {ready && <EditorSession scope={ready.scope} initial={initial} recovered={ready.recovered} projectName={projectName} />}
  </>;
}
