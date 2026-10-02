'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { createEditorStore } from '@/canvas/editor-v2/store';
import type { DraftScope } from '@/canvas/editor-v2/draft-contract';
import type { ApprovedDesign } from '@/lib/editor-document/approved-design';
import { EditorSceneView } from '../scene/editor-scene-view';
import { createWalkthroughVideoSaver } from './save-walkthrough-video';
import { ModernSelect } from '@/components/ui/modern-select';
import { ceilingSurfaces, eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import Link from 'next/link';

export function ApprovedDesignView({ approval, scope, initialRouteId, onBack, onOpenVideoStudio }: {
  approval: ApprovedDesign; scope: DraftScope; initialRouteId?: string | null; onBack: () => void; onOpenVideoStudio?: () => void;
}) {
  const [store] = useState(() => {
    const value = createEditorStore(approval.document, { readOnly: true });
    // La visita usa la revisión aprobada exacta, sin normalizaciones del borrador.
    value.setState({ document: structuredClone(approval.document) });
    if (initialRouteId && approval.document.walkthroughs?.some((route) => route.id === initialRouteId))
      value.getState().setWalkthrough(initialRouteId);
    return value;
  });
  const [presentation, setPresentation] = useState<'plan' | 'spatial'>('spatial');
  const routeId = useStore(store, (state) => state.walkthroughId);
  const routes = useMemo(() => approval.document.walkthroughs ?? [], [approval.document]);
  useEffect(() => {
    if (routes.length && !store.getState().walkthroughId) store.getState().setWalkthrough(routes[0]!.id);
  }, [routes, store]);
  const approximate = approval.assets.filter((asset) => !asset.sha256).length;
  const uncoveredRooms = useMemo(() => {
    try {
      return buildingDocuments(approval.document).flatMap((level) => {
        const covered = new Set(ceilingSurfaces(level.document).map((surface) => surface.room.id));
        const levelName = approval.document.levels?.find((item) => item.id === level.id)?.name;
        return eligibleCeilingRooms(level.document).filter((room) => !covered.has(room.id))
          .map((room) => {
            const roomName = level.document.labels.find((label) => insideRoom(label, room.boundary))?.text ?? 'estancia sin nombre';
            return levelName && approval.document.levels!.length > 1 ? `${levelName}: ${roomName}` : roomName;
          });
      });
    } catch { return []; }
  }, [approval.document]);
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
      {onOpenVideoStudio ? <button type="button" className="rounded-control bg-brand-600 px-3 py-2 text-white" onClick={onOpenVideoStudio}>Crear vídeo</button>
        : <Link className="rounded-control bg-brand-600 px-3 py-2 text-white" href={`/projects/${encodeURIComponent(scope.projectId)}/videos${scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : ''}`}>Crear vídeo</Link>}
      <button type="button" className="rounded border px-3 py-2" onClick={onBack}>Editar diseño</button>
    </header>
    {(approximate > 0 || uncoveredRooms.length > 0 || !routes.length) && <p className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-950">
      {approximate > 0 && `${approximate} objetos usan una representación aproximada; no se presentan como producto exacto. `}
      {uncoveredRooms.length > 0 && `${uncoveredRooms.length} estancias interiores sin techo (${uncoveredRooms.join(', ')}); la visita y el vídeo las muestran abiertas. `}
      {!routes.length && 'Para grabar una visita del modelo 3D, dibuja un recorrido en el borrador y aprueba una nueva revisión. Para presentar tus renders, abre «Vídeos con mis imágenes». La promoción de la parcela usa su propio guion.'}
    </p>}
    {routes.length > 1 && <label className="flex items-center gap-2 border-b px-4 py-2 text-sm">Recorrido del vídeo
      <ModernSelect className="rounded border px-2 py-1" value={routeId ?? ''} onChange={(event) => store.getState().setWalkthrough(event.target.value || null)}>
        {!routeId && <option value="">Selecciona un recorrido</option>}
        {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
      </ModernSelect>
    </label>}
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <EditorSceneView key={presentation} store={store} projectId={scope.projectId} presentation={presentation}
        lightingPreset={approval.lightingPreset} lightingLocked
        onSaveNativeVideo={createWalkthroughVideoSaver(scope, approval.id)} />
      </div>
    </div>
  </section>;
}
