'use client';

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { createEditorStore } from '@/canvas/editor-v2/store';
import type { DraftScope } from '@/canvas/editor-v2/draft-contract';
import type { ApprovedDesign } from '@/lib/editor-document/approved-design';
import { EditorSceneView } from '../scene/editor-scene-view';
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

  return <section className="flex min-h-[560px] flex-1 flex-col overflow-hidden border border-line bg-surface text-ink [&_button]:cursor-pointer">
    <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-sm">
      <button type="button" className="rounded-control border border-line px-3 py-2 hover:bg-surface-muted" onClick={onBack}>← Volver al editor</button>
      <div className="mr-auto">
        <strong>Revisar plano aprobado</strong>
        <p className="text-xs text-ink-soft">Solo lectura · revisión {approval.revision} · {new Date(approval.approvedAt).toLocaleDateString('es-ES')}</p>
      </div>
      <button type="button" className="rounded-control border border-line px-3 py-2 aria-pressed:bg-brand-50" aria-pressed={presentation === 'plan'} onClick={() => setPresentation('plan')}>Plano 2D</button>
      <button type="button" className="rounded-control border border-line px-3 py-2 aria-pressed:bg-brand-50" aria-pressed={presentation === 'spatial'} onClick={() => setPresentation('spatial')}>Modelo 3D</button>
      <a className="rounded border px-3 py-2" href={visitHref}>Enlace de esta versión</a>
      {onOpenVideoStudio ? <button type="button" className="rounded-control bg-brand-600 px-3 py-2 text-white" onClick={onOpenVideoStudio}>Crear vídeo</button>
        : <Link className="rounded-control bg-brand-600 px-3 py-2 text-white" href={`/projects/${encodeURIComponent(scope.projectId)}/videos${scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : ''}`}>Crear vídeo</Link>}
    </header>
    {(approximate > 0 || uncoveredRooms.length > 0 || !routes.length) && <details className="border-b border-line px-4 py-3 text-xs text-ink-soft"><summary className="cursor-pointer">Detalles de la guía: objetos y techos</summary><p className="mt-2">
      {approximate > 0 && `${approximate} objetos usan una representación aproximada; no se presentan como producto exacto. `}
      {uncoveredRooms.length > 0 && `${uncoveredRooms.length} estancias interiores sin techo (${uncoveredRooms.join(', ')}); revisa esta guía antes de preparar diseños. `}
      {!routes.length && 'Los recorridos del plano sirven para comprobar geometría. Para crear vídeos, revisa y acepta los diseños IA en Diseños.'}
    </p></details>}
    {routes.length > 0 && <label className="flex items-center gap-2 border-b px-4 py-2 text-sm">Comprobar recorrido del plano
      <ModernSelect aria-label="Recorrido de la guía" className="rounded border px-2 py-1" value={routeId ?? ''} onChange={(event) => store.getState().setWalkthrough(event.target.value || null)}>
        <option value="">Sin recorrido · vista libre</option>
        {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
      </ModernSelect>
    </label>}
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <EditorSceneView key={presentation} store={store} projectId={scope.projectId} presentation={presentation}
        lightingPreset={approval.lightingPreset} lightingLocked
        allowVideoExport={false} />
      </div>
    </div>
  </section>;
}
