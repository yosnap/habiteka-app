'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { EditorSaveQueue, hasPendingRemoteChanges } from '@/canvas/editor-v2/save-queue';
import { indexedDbDraftStorage } from '@/canvas/editor-v2/draft-storage';
import type { DraftScope, EditorDraft } from '@/canvas/editor-v2/draft-contract';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { saveEditorDocument } from '@/server/editor/save-document';
import { checkEditorSession } from '@/server/editor/check-session';
import { registerEditorSession } from '@/canvas/editor-v2/session-registry';
import { EditorShell } from '../editor-shell';

export function EditorSession({ scope, initial, recovered, projectName }: {
  scope: DraftScope; initial: EditorDocument; recovered?: EditorDraft; projectName: string;
}) {
  const [queue] = useState(() => new EditorSaveQueue(indexedDbDraftStorage, scope, initial, {
    reauthorize: () => checkEditorSession(scope), save: (request) => saveEditorDocument(scope, request),
  }, recovered));
  const [store] = useState(() => createEditorStore(queue.getDocument()));
  const status = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => {
    const unregister = registerEditorSession(scope.userId, queue);
    const watchClosed = queue.subscribe(() => {
      if (queue.getSnapshot().closed) store.setState({ readOnly: true, tool: 'select' });
    });
    let sequence = store.getState().sequence;
    const unsubscribe = store.subscribe((state) => {
      if (state.sequence === sequence) return;
      sequence = state.sequence;
      void queue.capture(state.document).catch(() => {});
    });
    const online = () => { queue.setOnline(navigator.onLine); if (navigator.onLine) void queue.flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = queue.getSnapshot();
      if (current.sequence > current.localSequence) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('online', online); window.addEventListener('offline', online);
    window.addEventListener('beforeunload', beforeUnload);
    online();
    return () => {
      unsubscribe(); window.removeEventListener('online', online); window.removeEventListener('offline', online);
      window.removeEventListener('beforeunload', beforeUnload);
      // No cancelar escrituras al navegar: el último gesto ya tiene una promesa durable en cola.
      void queue.flush().finally(unregister); watchClosed();
    };
  }, [queue, store, scope.userId]);
  const pendingChanges = hasPendingRemoteChanges(status);
  const saveStatus = status.closed ? 'Sesión cerrada' : status.conflict ? 'Conflicto · borrador conservado'
    : status.sequence > status.localSequence ? 'Guardando en este dispositivo…'
      : status.saving ? 'Guardando cambios…'
        : pendingChanges ? 'Cambios sin guardar' : 'Sincronizado';
  return <>
    {status.error && <p role="alert" className="bg-amber-100 p-3 text-amber-950">{status.error}</p>}
    {status.conflict && <section className="border-b bg-amber-50 p-4">
      <h2 className="font-semibold">Otra pestaña guardó la revisión {status.conflict.revision}</h2>
      <p>Tu edición se conserva en este dispositivo. No se enviarán más cambios hasta resolver el conflicto.</p>
    </section>}
    <EditorShell store={store} projectName={projectName} saveStatus={saveStatus} onSave={() => void queue.flush()}
      saveEnabled={pendingChanges && !status.saving && !status.closed && !status.conflict} />
  </>;
}
