'use client';
import { useEffect, useMemo, useState } from 'react';
import type { EditorScope } from '@/server/editor/authority';
import { loadDesignVideoReferences, prepareDesignConstruction, prepareDesignVisit } from '@/server/walkthrough/design-video-actions';
import { defaultDesignVideoReferenceIds, designVideoEstimate, designVideoLayoutReference, designVideoReferenceRole, type DesignVideoJob, type DesignVideoReference } from '@/lib/editor-document/design-video';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
import { VideoDurationControls } from './video-duration-controls';
import { DesignVideoTask } from './design-video-task';
import { Button } from '@/components/ui/button';
import { ModernSelect } from '@/components/ui/modern-select';
import Link from 'next/link';
import { continueRenderBatchHref, interiorsEditorHref } from './auto-generate-request';
import { RenderCleanupCardActions, RenderCleanupToolbar, useRenderCleanup } from '@/components/deliverables/render-cleanup';
import { VideoNameField } from '@/components/deliverables/video-name';
import { defaultDesignVisitReferenceIds, designVisitSelectionIssue } from '@/lib/editor-document/design-visit';

export function DesignConstructionPanel({ scope, approved, onReviewApproval, onBusyChange, portalContainer, goal = 'construction' }: {
  scope: EditorScope; approved: boolean; onReviewApproval: () => void; onBusyChange: (busy: boolean) => void; portalContainer?: HTMLElement | null;
  goal?: 'construction' | 'visit';
}) {
  const visit = goal === 'visit';
  const [media, setMedia] = useState<Awaited<ReturnType<typeof loadDesignVideoReferences>> | null>(null);
  const [ids, setIds] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [presentation, setPresentation] = useState({ ...DEFAULT_VIDEO_PRESENTATION });
  const [resolution, setResolution] = useState<'768P' | '2K'>('768P');
  const [task, setTask] = useState<{ id: string; job: DesignVideoJob } | null>(null);
  const [title, setTitle] = useState('');
  const [showOtherImages, setShowOtherImages] = useState(false);
  const cleanup = useRenderCleanup(scope, async (removed, isRemoval) => {
    const next = await loadDesignVideoReferences(scope); setMedia(next);
    if (isRemoval) setIds(current => current.filter(id => !removed.includes(id)));
  }, onBusyChange);
  useEffect(() => {
    let active = true;
    void loadDesignVideoReferences(scope).then(value => {
      if (!active) return; setMedia(value);
      setIds(visit ? defaultDesignVisitReferenceIds(value.references) : defaultDesignVideoReferenceIds(value.references));
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los diseños.'); });
    return () => { active = false; };
  }, [scope, approved, visit]);
  const selected = useMemo(() => ids.flatMap(id => {
    const reference = media?.references.find(reference => reference.id === id);
    return reference ? [reference] : [];
  }), [media, ids]);
  const groups = useMemo(() => {
    const result = new Map<string, DesignVideoReference[]>();
    for (const reference of media?.references ?? []) {
      if (visit && !showOtherImages && !cleanup.selecting && (reference.visitIssue || !reference.interiorRoomId)) continue;
      const key = reference.batchId ?? reference.id; result.set(key, [...(result.get(key) ?? []), reference]);
    }
    return [...result.values()];
  }, [media, visit, showOtherImages, cleanup.selecting]);
  const estimate = designVideoEstimate({ presentation, resolution }, selected.length);
  const included = [...new Set(selected.flatMap(reference => reference.zones))];
  const hasFinishedExterior = selected.some(reference => reference.closedRoof);
  const layoutReference = designVideoLayoutReference(selected);
  const visitIssue = visit ? designVisitSelectionIssue(selected) : null;
  const referenceIssue = (reference: DesignVideoReference) => reference.issue || (visit ? reference.visitIssue : undefined);
  const role = (reference: DesignVideoReference) => visit ? `${reference.interiorRoomName ?? 'Interior sin verificar'} · ${selected[0]?.id === reference.id ? 'Vista principal' : 'Apoyo del mismo interior'}` : designVideoReferenceRole(reference, selected);
  async function prepare() {
    if (!media?.approvalId) return;
    setBusy(true); onBusyChange(true); setError('');
    try { setTask(await (visit ? prepareDesignVisit : prepareDesignConstruction)(scope, media.approvalId, ids, { presentation, resolution }, title)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar la prueba.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <section className="mx-auto w-full max-w-6xl space-y-5 p-5 lg:p-6">
    <header><h2 className="text-xl font-semibold">{visit ? 'Primera persona desde mis diseños' : 'Construcción desde mis diseños'}</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">{visit ? 'Prepara una toma interior de 8 o 12 segundos a partir del diseño generado de una estancia. Sus muebles y acabados son la referencia del vídeo.' : 'Las imágenes elegidas son las referencias de la casa, las zonas exteriores y los muebles. Se pide construir el conjunto de ese diseño. No se usa el inventario de muebles del plano.'}</p>
      <p className="mt-2 text-xs text-ink-soft">Piloto MiniMax H3 en KIE: necesita revisión de fidelidad antes de aceptar el resultado. Preparar la prueba no consume IA; generar requiere confirmar imágenes y coste.</p></header>
    <p className="text-sm text-ink-soft">{visit ? 'Elige una vista Interior por estancia, a altura de ojos, con paredes y techo completos. Se pide un movimiento corto dentro de esa habitación. El recorrido continuo entre habitaciones y el montaje con construcción siguen pendientes.' : 'La selección inicial usa una cenital para distribución y muebles, y un exterior para fachadas y tejado. Puedes añadir vistas de apoyo de esa tanda. La referencia principal manda sobre el mobiliario si otras vistas discrepan.'}</p>
    {!approved && <div className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3"><p className="text-sm">Revisa la aprobación del diseño y la luz antes de preparar el vídeo.</p><Button variant="outline" onClick={onReviewApproval}>Revisar y aprobar</Button></div>}
    {!media && !error && <p role="status">Cargando las tandas del diseño aprobado…</p>}
    {media && !media.references.length && <p role="status">No hay imágenes generadas compatibles con la revisión aprobada. Genera vistas del conjunto y del interiorismo antes de preparar la prueba.</p>}
    {!task && <RenderCleanupToolbar cleanup={cleanup} images={media?.references ?? []} disabled={busy} />}
    {!task && visit && <div className="flex flex-wrap items-center gap-3">
      <Link className="inline-flex rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted" href={interiorsEditorHref(scope.projectId, scope.zoneId ?? null)}>Crear vistas interiores</Link>
      <Button variant="outline" size="sm" disabled={busy || cleanup.busy} aria-pressed={showOtherImages} onClick={() => setShowOtherImages(!showOtherImages)}>{showOtherImages ? 'Mostrar solo interiores' : 'Mostrar también otras vistas'}</Button>
      <p className="text-xs text-ink-soft">Abrir el editor no genera ni cobra imágenes. Revisa la estancia, el estilo y el presupuesto antes de generar.</p>
    </div>}
    {!task && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">{visit && media && !groups.length && <p role="status" className="rounded-card border border-dashed border-line p-5 text-sm text-ink-soft">Todavía no hay vistas interiores compatibles. Abre «Crear vistas interiores», elige una estancia y prepara su diseño a altura de ojos con techo completo. Después vuelve aquí para preparar la toma.</p>}
      {groups.map((group, index) => <fieldset key={group[0]!.id} disabled={busy || cleanup.busy} className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Tanda {index + 1} · revisión {group[0]!.revision}</legend>
        <p className="text-sm text-ink-soft">{[...new Set(group.flatMap(reference => reference.zones))].join(', ') || group[0]!.name}</p>
        {group[0]!.batchId && <Link className="inline-flex rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-soft" href={continueRenderBatchHref(scope.projectId, scope.zoneId ?? null, group[0]!.batchId)}>Completar vistas de la tanda {index + 1}</Link>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{group.map(reference => <div key={reference.id} className={`group relative overflow-hidden rounded-control border ${ids.includes(reference.id) ? 'border-brand-500 ring-1 ring-brand-500' : 'border-line'}`}>
          <RenderCleanupCardActions cleanup={cleanup} id={reference.id} label={`${reference.view} de la tanda ${index + 1}`} disabled={busy} />
          <label className={referenceIssue(reference) ? 'cursor-not-allowed' : 'cursor-pointer'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reference.url} alt={`${reference.name} · ${reference.view}`} className="aspect-video w-full object-cover" loading="lazy" />
          <span className="flex items-start gap-2 p-2 text-xs"><input type="checkbox" aria-label={`Usar ${reference.view} de la tanda ${index + 1}`} disabled={Boolean(referenceIssue(reference))} checked={ids.includes(reference.id)}
            onChange={event => setIds(event.target.checked ? [...ids, reference.id] : ids.filter(id => id !== reference.id))} />{reference.view}</span>
          {ids.includes(reference.id) && <span className="block px-2 pb-2 text-xs text-ink-soft">{role(reference)}</span>}
          {referenceIssue(reference) && <span className={`block px-2 pb-2 text-xs ${reference.issue ? 'text-danger' : 'text-ink-soft'}`}><strong>{reference.issue ? 'No válida' : 'No compatible'} para {visit ? 'primera persona' : 'construcción'}.</strong> {referenceIssue(reference)}</span>}
        </label></div>)}</div>
      </fieldset>)}</div>
      <aside className="space-y-4 rounded-card border border-line p-4"><fieldset disabled={busy || cleanup.busy} className="space-y-4">
        <VideoNameField value={title} onChange={setTitle} />
        {visit ? <label className="block text-sm">Duración de la toma<ModernSelect aria-label="Duración de primera persona H3" value={String(presentation.constructionDurationSeconds ?? 8)} portalContainer={portalContainer} popoverZIndex={150}
          onChange={event => setPresentation({ ...presentation, constructionDurationSeconds: Number(event.target.value) as 8 | 12 })} className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2">
          <option value="8">8 segundos · prueba corta</option><option value="12">12 segundos · movimiento más lento</option></ModernSelect></label>
          : <VideoDurationControls value={presentation} onChange={setPresentation} combined={false} portalContainer={portalContainer} />}
        <label className="block text-sm">Calidad<ModernSelect aria-label="Calidad de la prueba H3" value={resolution} portalContainer={portalContainer} popoverZIndex={150} onChange={event => setResolution(event.target.value as '768P' | '2K')} className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2">
          <option value="768P">768P · prueba económica</option><option value="2K">2K · mayor detalle</option></ModernSelect></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={presentation.soundEffects} onChange={event => setPresentation({ ...presentation, soundEffects: event.target.checked })} />{visit ? 'Pedir ambiente interior suave' : 'Pedir efectos sincronizados'}</label>
        <label className="block text-sm">Indicaciones para el vídeo<textarea aria-label={`Indicaciones para ${visit ? 'primera persona' : 'construcción'} desde diseños`} maxLength={2000} value={presentation.prompt ?? ''}
          onChange={event => setPresentation({ ...presentation, prompt: event.target.value })} className="mt-1 min-h-24 w-full rounded-control border border-line bg-surface p-2 text-sm"
          placeholder={visit ? 'Ej.: acercarse suavemente al sofá sin cambiar la posición de la TV.' : 'Ej.: mostrar el patio y el baño exterior; conservar todas las camas del diseño.'} /></label>
      </fieldset>
      <p className="text-sm"><strong>Se incluye:</strong> {visit ? selected[0]?.interiorRoomName ?? 'La estancia de la referencia interior elegida.' : included.join(', ') || 'El ámbito visible de las imágenes elegidas.'}</p>
      <p className="text-sm text-ink-soft">{ids.length} referencias · coste previsto ${estimate.usd.toFixed(2)}. Las primeras cinco referencias no añaden coste; cada imagen adicional suma $0.02.</p>
      <p className="text-xs text-ink-soft">El ritmo y los efectos se piden mediante el guion; revisa que H3 los respete. Cotas exactas pendientes para clips IA.</p>
      {!visit && media && !hasFinishedExterior && <p role="status" className="text-sm">Falta el exterior con tejado. En Diseñar con IA, genera Exterior terminado y una cenital del mismo ámbito y tanda, junto a las vistas que quieras incluir.</p>}
      {!visit && media && !layoutReference && <p role="status" className="text-sm">Falta la distribución: elige una cenital, isométrica o dron del conjunto y de la misma tanda.</p>}
      {visit && visitIssue && <p role="status" className="text-sm">{visitIssue}</p>}
      <Button className="w-full" disabled={busy || cleanup.busy || !approved || !media?.providerReady || !ids.length || ids.length > 9 || (visit ? Boolean(visitIssue) : !hasFinishedExterior || !layoutReference)} onClick={() => void prepare()}>{busy ? 'Preparando…' : 'Preparar prueba H3'}</Button>
      {ids.length > 9 && <p role="status" className="text-sm">H3 admite hasta nueve imágenes. Elige referencias de la misma tanda que cubran todo el diseño.</p>}
      {media && !media.providerReady && <p role="status" className="text-sm">KIE debe estar configurado y activo en los ajustes de IA.</p>}
      </aside>
    </div>}
    {task && <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{selected.map(reference => <figure key={reference.id} className="overflow-hidden rounded-control border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={reference.url} alt={`${reference.name} · ${reference.view}`} className="aspect-video w-full object-cover" />
      <figcaption className="p-2 text-xs">Referencia {selected.indexOf(reference) + 1} · {reference.view} · {role(reference)}</figcaption>
    </figure>)}</div><DesignVideoTask key={task.id} scope={scope} id={task.id} initial={task.job} onBusyChange={onBusyChange} onEdit={() => setTask(null)} /></>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>;
}
