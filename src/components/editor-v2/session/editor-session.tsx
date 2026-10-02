'use client';

import { listStoryboardImages } from '@/server/walkthrough/storyboard-gallery';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { useRouter } from 'next/navigation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { EditorSaveQueue, hasPendingRemoteChanges } from '@/canvas/editor-v2/save-queue';
import { indexedDbDraftStorage } from '@/canvas/editor-v2/draft-storage';
import type { DraftScope, EditorDraft } from '@/canvas/editor-v2/draft-contract';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { approveEditorDesign, loadCurrentEditorDocument, loadLatestApprovedEditorDesign, saveEditorDocument } from '@/server/editor/save-document';
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
import { useAutoGenerateRequest } from '../use-auto-generate-request';
import type { PlanReference } from '@/lib/editor-document/plan-reference';
import { sameDesignContent, type ApprovedDesign, type ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { ApprovedDesignView } from './approved-design-view';
import { ApprovalReviewDialog } from './approval-review-dialog';

export function EditorSession({
  scope,
  initial,
  approvedDesign,
  recovered,
  projectName,
  autoGenerate,
  reference,
}: {
  scope: DraftScope;
  initial: EditorDocument;
  approvedDesign: ApprovedDesign | null;
  recovered?: EditorDraft;
  projectName: string;
  autoGenerate?: AutoGenerateRequest | null;
  reference?: PlanReference | null;
}) {
  const router = useRouter();
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
  useEffect(() => {
    const key = `habiteka:walkthrough-ui:${scope.userId}:${scope.projectId}:${scope.zoneId ?? 'default'}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { id?: string; panelOpen?: boolean } | null;
      if (saved?.id && store.getState().document.walkthroughs?.some((route) => route.id === saved.id))
        store.getState().setWalkthrough(saved.id);
      if (saved?.panelOpen) store.getState().openSidePanel('walkthrough');
    } catch { /* La edición continúa aunque el navegador no permita recordar el panel. */ }
    return store.subscribe((state, previous) => {
      if (state.walkthroughId === previous.walkthroughId && state.sidePanel === previous.sidePanel) return;
      try { sessionStorage.setItem(key, JSON.stringify({ id: state.walkthroughId,
        panelOpen: state.sidePanel === 'walkthrough' })); } catch { /* Estado de sesión opcional. */ }
    });
  }, [scope.userId, scope.projectId, scope.zoneId, store]);
  const [approval, setApproval] = useState(approvedDesign);
  const [approvedRouteId, setApprovedRouteId] = useState<string | null>(null);
  const [lightingPreset, setLightingPreset] = useState<ApprovedLightingPreset>(approvedDesign?.lightingPreset ?? 'daylight');
  const [reviewApproval, setReviewApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [viewApproved, setViewApproved] = useState(false);
  useAutoGenerateRequest(autoGenerate, () => setViewApproved(false));
  const restoring = useRef(false);
  const status = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const currentDocument = useStore(store, (state) => state.document);
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
  const needsApproval = useMemo(() => !approval ||
    !sameDesignContent(currentDocument, approval.document), [currentDocument, approval]);
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
    qualityAck: boolean;
    styleAnchor?: boolean;
    orthophotoDataUrl?: string;
    existingImageDataUrl?: string;
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
          qualityAck: input.qualityAck,
          ...(input.styleAnchor ? { styleAnchor: true } : {}),
          orthophotoDataUrl: input.orthophotoDataUrl,
          existingImageDataUrl: input.existingImageDataUrl,
        },
      ),
    );
  };
  const approve = async () => {
    if (approving) return;
    setApproving(true); setApprovalError(null);
    const proposed = structuredClone(store.getState().document);
    try {
      await Promise.resolve();
      await queue.flush();
      const state = queue.getSnapshot();
      if (state.closed || state.conflict || hasPendingRemoteChanges(state))
        throw new Error('Sincroniza el borrador y resuelve cualquier conflicto antes de aprobar.');
      const saved = await loadCurrentEditorDocument(scope);
      if (!sameDesignContent(saved, proposed) || !sameDesignContent(store.getState().document, proposed))
        throw new Error('El diseño cambió mientras se preparaba la aprobación. Revisa y vuelve a confirmar.');
      const next = await approveEditorDesign(scope, saved.revision, lightingPreset);
      setApproval(next); setApprovedRouteId(store.getState().walkthroughId);
      setReviewApproval(false);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'No se pudo aprobar el diseño.');
    } finally { setApproving(false); }
  };
  const openApproved = async (routeId: string | null) => {
    setApprovalError(null);
    try {
      // Otra pestaña puede haber aprobado una revisión mientras este editor seguía abierto.
      const latest = await loadLatestApprovedEditorDesign(scope);
      if (!latest) throw new Error('Aprueba el diseño antes de exportar su recorrido.');
      if (routeId) {
        const approvedRoute = latest.document.walkthroughs?.find((route) => route.id === routeId);
        if (!approvedRoute) throw new Error('Este recorrido aún no está aprobado. Guarda y aprueba los cambios para exportarlo.');
        const draftRoute = store.getState().document.walkthroughs?.find((route) => route.id === routeId);
        if (draftRoute && JSON.stringify(draftRoute) !== JSON.stringify(approvedRoute))
          throw new Error('Este recorrido cambió desde la aprobación. Guarda y aprueba los cambios antes de exportarlo.');
      }
      setApproval(latest); setApprovedRouteId(routeId); setViewApproved(true);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'No se pudo abrir la visita aprobada.');
    }
  };
  const openVideos = async () => {
    setApprovalError(null);
    try {
      await Promise.resolve();
      await queue.flush();
      const state = queue.getSnapshot();
      if (state.closed || state.conflict || hasPendingRemoteChanges(state))
        throw new Error('Guarda los cambios y resuelve cualquier conflicto antes de abrir Vídeos.');
      router.push(`/projects/${encodeURIComponent(scope.projectId)}/videos${scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : ''}`);
    } catch (cause) { setApprovalError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.'); }
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
      <ApprovalReviewDialog open={reviewApproval && !viewApproved} pending={approving} error={approvalError} lighting={lightingPreset}
        onLightingChange={setLightingPreset} onClose={() => setReviewApproval(false)} onConfirm={() => void approve()} />
      {approvalError && !reviewApproval && <p role="alert" className="bg-amber-100 px-4 py-2 text-sm text-amber-950">{approvalError}</p>}
      {viewApproved && approval ? <ApprovedDesignView key={`${approval.id}:${approvedRouteId ?? ''}`} approval={approval} scope={scope}
        initialRouteId={approvedRouteId} onOpenVideoStudio={() => void openVideos()} onBack={() => setViewApproved(false)} /> : <EditorShell
        preferencesOwner={scope.userId}
        store={store}
        reference={reference}
        projectName={projectName}
        onOpenVideoStudio={() => void openVideos()}
        loadStoryboardImages={loadStoryboardImages}
        saveStatus={saveStatus}
        onSave={() => void queue.flush()}
        saveEnabled={pendingChanges && !status.saving && !status.closed && !status.conflict}
        onApproveDesign={needsApproval ? () => { setApprovalError(null); setReviewApproval(true); } : undefined}
        approveDisabled={status.closed || Boolean(status.conflict) || approving}
        approveLabel={approval ? 'Aprobar cambios' : 'Aprobar diseño'}
        onOpenApproved={approval ? () => void openApproved(null) : undefined}
        videoResultsHref={`/projects/${encodeURIComponent(scope.projectId)}/deliverables?vista=videos${scope.zoneId ? `&zona=${encodeURIComponent(scope.zoneId)}` : ''}`}
        onOpenApprovedRoute={(routeId) => openApproved(routeId)}
        projectId={scope.projectId}
        zoneId={scope.zoneId}
        allowVideoExport={false}
        lightingPreset={lightingPreset}
        onLightingChange={setLightingPreset}
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
      />}
    </>
  );
}
