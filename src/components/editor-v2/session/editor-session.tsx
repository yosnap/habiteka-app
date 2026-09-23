'use client';

import { listStoryboardImages } from '@/server/walkthrough/storyboard-gallery';
import { saveWalkthroughVideo } from './save-walkthrough-video';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { EditorSaveQueue, hasPendingRemoteChanges } from '@/canvas/editor-v2/save-queue';
import { indexedDbDraftStorage } from '@/canvas/editor-v2/draft-storage';
import type { DraftScope, EditorDraft } from '@/canvas/editor-v2/draft-contract';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { loadCurrentEditorDocument, saveEditorDocument } from '@/server/editor/save-document';
import { EditorConflictBanner } from './editor-conflict-banner';
import { checkEditorSession } from '@/server/editor/check-session';
import { registerEditorSession } from '@/canvas/editor-v2/session-registry';
import {
  generateConceptRenderFromEditor,
  estimateConceptRenderFromEditor,
  proposeNativeDesignFromEditor,
  saveNativeRender,
} from '@/app/(app)/projects/[id]/_actions/agent-actions';
import { evaluateEditorQuality } from '@/app/(app)/projects/[id]/_actions/editor-quality-actions';
import { callAction } from '@/lib/action-result';
import { EditorShell } from '../editor-shell';
import type { AutoGenerateRequest } from '../auto-generate-request';

export function EditorSession({
  scope,
  initial,
  recovered,
  projectName,
  autoGenerate,
}: {
  scope: DraftScope;
  initial: EditorDocument;
  recovered?: EditorDraft;
  projectName: string;
  autoGenerate?: AutoGenerateRequest | null;
}) {
  const [queue] = useState(
    () =>
      new EditorSaveQueue(
        indexedDbDraftStorage,
        scope,
        initial,
        {
          reauthorize: () => checkEditorSession(scope),
          save: (request) => saveEditorDocument(scope, request),
        },
        recovered,
      ),
  );
  const [store] = useState(() => createEditorStore(queue.getDocument()));
  const restoring = useRef(false);
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
      if (restoring.current) return;
      void queue.capture(state.document).catch(() => {});
    });
    const online = () => {
      queue.setOnline(navigator.onLine);
      if (navigator.onLine) void queue.flush();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = queue.getSnapshot();
      if (current.sequence > current.localSequence) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('beforeunload', beforeUnload);
    online();
    return () => {
      unsubscribe();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('beforeunload', beforeUnload);
      // No cancelar escrituras al navegar: el último gesto ya tiene una promesa durable en cola.
      void queue.flush().finally(unregister);
      watchClosed();
    };
  }, [queue, store, scope.userId]);
  const loadStoryboardImages = useCallback(() => listStoryboardImages({ projectId: scope.projectId, zoneId: scope.zoneId }), [scope.projectId, scope.zoneId]);
  const pendingChanges = hasPendingRemoteChanges(status);
  const saveStatus = status.closed
    ? 'Sesión cerrada'
    : status.conflict
      ? 'Conflicto · borrador conservado'
      : status.sequence > status.localSequence
        ? 'Guardando en este dispositivo…'
        : status.saving
          ? 'Guardando cambios…'
          : pendingChanges
            ? 'Cambios sin guardar'
            : 'Sincronizado';
  const generate = async (input: {
    estilo: import('@/lib/contracts').Estilo;
    objetivo: string;
    promptLibre: string;
    options: import('@/lib/editor-document/render-design-options').RenderDesignOptions;
    qualityAck: boolean;
  }) => {
    // Zustand notifica la captura sincrónicamente; esta pausa deja que entre en la
    // cola durable antes de forzar el flush. Nunca se manda a IA un conflicto o un
    // documento que el servidor no haya confirmado.
    await Promise.resolve();
    await queue.flush();
    const current = queue.getSnapshot();
    if (current.closed)
      throw new Error('La sesión de edición está cerrada. Vuelve a abrir el proyecto.');
    if (current.conflict)
      throw new Error('Resuelve el conflicto de edición antes de generar un diseño.');
    if (hasPendingRemoteChanges(current))
      throw new Error(
        'No se pudieron sincronizar todos los cambios. Revisa tu conexión e inténtalo de nuevo.',
      );
    const designSpaceKind = store.getState().document.designSpaceKind;
    if (!designSpaceKind)
      throw new Error('Define el tipo de espacio en el canvas antes de generar un diseño.');
    return callAction(
      proposeNativeDesignFromEditor(
        scope.projectId,
        store.getState().document,
        input.estilo,
        designSpaceKind,
        input.objetivo,
        input.promptLibre,
        scope.zoneId,
        input.options,
        input.qualityAck,
      ),
    );
  };
  const render = async (input: {
    estilo: import('@/lib/contracts').Estilo;
    objetivo: string;
    promptLibre: string;
    capture?: import('@/lib/editor-document/render-view').RenderCapture;
    options?: import('@/lib/editor-document/render-design-options').RenderDesignOptions;
    batchId?: string;
    referenceDesignId?: string;
    qualityAck: boolean;
  }) => {
    const geometry = JSON.stringify({ ...store.getState().document, revision: 0 });
    await Promise.resolve();
    await queue.flush();
    const current = queue.getSnapshot();
    if (current.closed) throw new Error('La sesión de edición está cerrada. Vuelve a abrir el proyecto.');
    if (current.conflict) throw new Error('Resuelve el conflicto de edición antes de crear un render.');
    if (hasPendingRemoteChanges(current)) throw new Error('No se pudieron sincronizar todos los cambios. Revisa tu conexión e inténtalo de nuevo.');
    if (input.capture && geometry !== JSON.stringify({ ...store.getState().document, revision: 0 })) throw new Error('El plano cambió mientras se guardaba. Vuelve a capturar la vista.');
    return callAction(
      generateConceptRenderFromEditor(
        scope.projectId,
        store.getState().document,
        input.estilo,
        input.objetivo,
        input.promptLibre,
        scope.zoneId,
        input.capture,
        {
          options: input.options,
          batchId: input.batchId,
          referenceDesignId: input.referenceDesignId,
          qualityAck: input.qualityAck,
        },
      ),
    );
  };
  return (
    <>
      {status.error && !status.conflict && (
        <p role="alert" className="bg-amber-100 p-3 text-amber-950">
          {status.error}
        </p>
      )}
      {status.conflict && (
        <EditorConflictBanner revision={status.conflict.revision} disabled={status.closed}
          onDownload={() => {
            const blob = new Blob([JSON.stringify({ format: 'habiteka-conflict-backup-v1',
              local: queue.getDocument(), server: queue.getSnapshot().conflict }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `habiteka-respaldo-${scope.projectId}.json`;
            link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          onResolve={async (choice) => {
            store.setState({ readOnly: true, tool: 'select' });
            try {
              const document = await queue.resolveConflict(choice, () => loadCurrentEditorDocument(scope));
              restoring.current = true;
              if (choice === 'server') store.getState().restore(document);
              else store.setState({ document });
            } finally {
              restoring.current = false;
              store.setState({ readOnly: queue.getSnapshot().closed });
            }
          }} />
      )}
      <EditorShell
        store={store}
        projectName={projectName}
        loadStoryboardImages={loadStoryboardImages}
        saveStatus={saveStatus}
        onSave={() => void queue.flush()}
        saveEnabled={pendingChanges && !status.saving && !status.closed && !status.conflict}
        projectId={scope.projectId}
        onSaveNativeVideo={async (blob, routeId) => {
          await queue.flush();
          const current = queue.getSnapshot();
          if (current.conflict || current.closed || hasPendingRemoteChanges(current)) throw new Error('El MP4 se descargó. Sincroniza el plano antes de guardarlo en Diseños.');
          await saveWalkthroughVideo(scope, blob, routeId);
        }}
        onSaveNativeRender={async (capture) => {
          await callAction(
            saveNativeRender(scope.projectId, capture.dataUrl, scope.zoneId, capture.view),
          );
        }}
        autoGenerate={autoGenerate ?? null}
        onGenerateDesign={generate}
        onGenerateRender={render}
        onEstimateRender={(viewCount) =>
          callAction(estimateConceptRenderFromEditor(scope.projectId, viewCount))
        }
        onEvaluateQuality={() =>
          // El documento EN PANTALLA, no el guardado: es el que juzgará la
          // puerta al generar, así que el veredicto del diálogo y el del
          // servidor hablan del mismo plano (y comparten caché).
          callAction(
            evaluateEditorQuality(scope.projectId, store.getState().document, scope.zoneId),
          )
        }
        generateEnabled={!status.closed && !status.conflict}
        generateDisabledReason={
          status.conflict
            ? 'Resuelve el conflicto antes de generar'
            : status.closed
              ? 'La sesión de edición está cerrada'
              : undefined
        }
      />
    </>
  );
}
