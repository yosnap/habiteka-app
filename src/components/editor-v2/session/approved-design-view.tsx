'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { createEditorStore } from '@/canvas/editor-v2/store';
import type { DraftScope } from '@/canvas/editor-v2/draft-contract';
import type { ApprovedDesign } from '@/lib/editor-document/approved-design';
import { EditorSceneView } from '../scene/editor-scene-view';
import { saveWalkthroughVideo } from './save-walkthrough-video';
import { ModernSelect } from '@/components/ui/modern-select';

export function ApprovedDesignView({ approval, scope, onBack }: {
  approval: ApprovedDesign; scope: DraftScope; onBack: () => void;
}) {
  const [store] = useState(() => {
    const value = createEditorStore(approval.document, { readOnly: true });
    // La visita usa la revisión aprobada exacta, sin normalizaciones del borrador.
    value.setState({ document: structuredClone(approval.document) });
    return value;
  });
  const [presentation, setPresentation] = useState<'plan' | 'spatial'>('spatial');
  const routeId = useStore(store, (state) => state.walkthroughId);
  const routes = useMemo(() => approval.document.walkthroughs ?? [], [approval.document]);
  useEffect(() => {
    if (routes.length && !store.getState().walkthroughId) store.getState().setWalkthrough(routes[0]!.id);
  }, [routes, store]);
  const approximate = approval.assets.filter((asset) => !asset.sha256).length;
  const visitQuery = new URLSearchParams({ aprobado: approval.id });
  if (scope.zoneId) visitQuery.set('zona', scope.zoneId);
  const visitHref = `/projects/${encodeURIComponent(scope.projectId)}/editor?${visitQuery}`;

  return <section className="flex min-h-[560px] flex-1 flex-col overflow-hidden border border-emerald-900/15 bg-white">
    <header className="flex flex-wrap items-center gap-3 border-b border-emerald-900/15 px-4 py-3 text-sm">
      <div className="mr-auto">
        <strong>Diseño aprobado · revisión {approval.revision}</strong>
        <p className="text-xs text-slate-600">{new Date(approval.approvedAt).toLocaleString('es-ES')} · La visita y el vídeo usan esta versión.</p>
      </div>
      <button type="button" className="rounded border px-3 py-2" aria-pressed={presentation === 'plan'} onClick={() => setPresentation('plan')}>Plano visual</button>
      <button type="button" className="rounded border px-3 py-2" aria-pressed={presentation === 'spatial'} onClick={() => setPresentation('spatial')}>3D y visita</button>
      <a className="rounded border px-3 py-2" href={visitHref}>Enlace de esta versión</a>
      <button type="button" className="rounded border px-3 py-2" onClick={onBack}>Editar diseño</button>
    </header>
    {(approximate > 0 || !routes.length) && <p className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-950">
      {approximate > 0 && `${approximate} objetos usan una representación aproximada; no se presentan como producto exacto. `}
      {!routes.length && 'Para crear un MP4, dibuja un recorrido en el borrador y aprueba una nueva revisión.'}
    </p>}
    {routes.length > 1 && <label className="flex items-center gap-2 border-b px-4 py-2 text-sm">Recorrido del vídeo
      <ModernSelect className="rounded border px-2 py-1" value={routeId ?? routes[0]!.id} onChange={(event) => store.getState().setWalkthrough(event.target.value)}>
        {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
      </ModernSelect>
    </label>}
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <EditorSceneView key={presentation} store={store} presentation={presentation}
        lightingPreset={approval.lightingPreset} lightingLocked
        onSaveNativeVideo={(blob, id, mode) => saveWalkthroughVideo(scope, approval.id, blob, id, mode)} />
      </div>
    </div>
  </section>;
}
