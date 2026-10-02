'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { useStore } from 'zustand';
import { Check, Clapperboard, Hammer, Footprints, Megaphone, Play, X } from 'lucide-react';
import { createEditorStore, type EditorStore } from '@/canvas/editor-v2/store';
import type { EditorScope } from '@/server/editor/authority';
import type { ApprovedDesign, ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { VIDEO_GOALS, videoStudioReadiness, type VideoGoal } from '@/lib/editor-document/video-studio';
import { nativeVideoNeedsRoute, type NativeVideoMode } from '@/lib/editor-document/native-video';
import { LIGHTING_LABELS, LIGHTING_PRESETS } from '@/lib/lighting-preset';
import { DEFAULT_VIDEO_PRESENTATION } from './scene/construction-audio';
import type { SceneVideoControl, SceneVideoStatus } from './scene/scene-video-control';
import { ExteriorRoofPanel } from './exterior-roof-panel';
import { GeographicSitePanel } from './geographic-site-panel';
import { WalkthroughPanel } from './walkthrough-panel';
import { VideoStudioMedia } from './video-studio-media';
import { VideoDimensionControls } from './video-dimension-controls';
import { VideoDurationControls } from './video-duration-controls';
import { DesignConstructionPanel } from './design-construction-panel';
import { VideoPromptControls } from './video-prompt-controls';
import { saveWalkthroughVideo } from './session/save-walkthrough-video';
import { Button } from '@/components/ui/button';
import { videoScopeRegions, type VideoContentScope } from '@/lib/editor-document/video-content-scope';

const EditorSceneView = dynamic(() => import('./scene/editor-scene-view').then(module => module.EditorSceneView), { ssr: false });
const CanvasView = dynamic(() => import('./canvas-view').then(module => module.CanvasView), { ssr: false });
const ICONS = { construction: Hammer, advertising: Megaphone, visit: Footprints, combined: Clapperboard };
const INITIAL_STATUS: SceneVideoStatus = { ready: false, busy: false, progress: 0, siteReady: false, message: null, previewUrl: null };

interface Props {
  store: EditorStore; scope: EditorScope; projectName: string; approval: ApprovedDesign | null;
  approvalCurrent: boolean; approvalDisabled: boolean; approvalError?: string | null;
  lighting: ApprovedLightingPreset; onLightingChange: (value: ApprovedLightingPreset) => void;
  onReviewApproval: () => void; onSave: () => void; onClose: () => void;
}

/** La preparación modifica el borrador; la grabación usa siempre la instantánea aprobada exacta. */
export function VideoStudioDialog(props: Props) {
  const { store, scope, projectName, approval, approvalCurrent, approvalDisabled, approvalError,
    lighting, onLightingChange, onReviewApproval, onClose } = props;
  const [goal, setGoal] = useState<VideoGoal>('construction');
  const [tab, setTab] = useState<'create' | 'saved'>('create');
  const [source, setSource] = useState<'images' | 'model'>('images');
  const [preview, setPreview] = useState<'scene' | 'plan' | 'result'>('scene');
  const [options, setOptions] = useState({ ...DEFAULT_VIDEO_PRESENTATION, contentScope: 'house' as VideoContentScope });
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [imageBusy, setImageBusy] = useState(false);
  const busy = status.busy || imageBusy;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const control = useRef<SceneVideoControl | null>(null);
  const document = useStore(store, state => state.document);
  const routeId = useStore(store, state => state.walkthroughId);
  const editorError = useStore(store, state => state.error);
  const readonly = useStore(store, state => state.readOnly);
  const item = VIDEO_GOALS.find(item => item.id === goal)!;
  const mode: NativeVideoMode = goal === 'construction' ? 'construction' : goal === 'advertising' ? 'promotion' : goal === 'visit' ? 'walkthrough' : 'showcase';
  const needsRoute = nativeVideoNeedsRoute(mode);
  const constructionDesigns = goal === 'construction' && source === 'images';
  const imagesMode = (goal === 'advertising' || goal === 'construction') && source === 'images';
  const approved = approvalCurrent && approval?.lightingPreset === lighting;
  const approvedStore = useMemo(() => {
    if (!approval) return null;
    const value = createEditorStore(approval.document, { readOnly: true });
    value.setState({ document: structuredClone(approval.document), ceilingView: 'solid' });
    return value;
  }, [approval]);
  const previewStore = approved && approvedStore ? approvedStore : store;
  const routePlaying = useStore(previewStore, state => state.walkthroughPlaying);
  const readiness = useMemo(() => videoStudioReadiness(document, mode, routeId, options), [document, mode, routeId, options]);
  useEffect(() => {
    const state = store.getState();
    if (!state.walkthroughId && state.document.walkthroughs?.length) state.setWalkthrough(state.document.walkthroughs[0]!.id);
    const ceilingBefore = state.ceilingView;
    state.setCeilingView('solid');
    return () => { store.getState().setWalkthroughPlaying(false); store.getState().setTool('select'); store.getState().setCeilingView(ceilingBefore); };
  }, [store]);
  useEffect(() => { approvedStore?.getState().setWalkthrough(routeId); }, [approvedStore, routeId]);
  const onStatus = useCallback((next: SceneVideoStatus) => setStatus(next), []);
  const sceneStudio = useMemo(() => ({ mode, contentScope: options.contentScope, controlRef: control, onStatus }), [mode, options.contentScope, onStatus]);
  const scopeIssue = useMemo(() => {
    try { videoScopeRegions(document, options.contentScope); return null; }
    catch (error) { return error instanceof Error ? error.message : 'Revisa el ámbito del vídeo.'; }
  }, [document, options.contentScope]);
  const savedKey = `${approval?.id}:${status.message}:${status.previewUrl ?? ''}`;
  const exportIssue = readiness.issue || scopeIssue || (!approved ? 'Guarda y aprueba esta revisión antes de crear el vídeo.'
    : !status.ready ? 'Preparando la vista 3D…' : document.geographicSite?.confirmed && !status.siteReady ? 'Cargando la fotografía de la parcela…' : null);
  function chooseGoal(value: VideoGoal) {
    setGoal(value); setPreview('scene'); store.getState().setWalkthroughPlaying(false); store.getState().setTool('select');
  }
  const editRoute = () => { store.getState().setWalkthroughPlaying(false); setPreview('plan'); };
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
      <Dialog.Content ref={setContainer} onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        className="fixed inset-0 z-[101] flex flex-col overflow-hidden bg-surface text-ink sm:inset-3 sm:rounded-card sm:border sm:border-line sm:shadow-2xl [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div><Dialog.Title className="flex items-center gap-2 text-xl font-semibold"><Clapperboard size={22} className="text-brand-600" />Crear vídeo</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">{projectName} · prepara, crea y revisa tu vídeo aquí.</Dialog.Description></div>
          <Dialog.Close disabled={busy} aria-label="Cerrar estudio de vídeo" className="rounded-control border border-line p-2"><X size={20} /></Dialog.Close>
        </header>
        <nav aria-label="Estudio de vídeo" className="flex shrink-0 gap-5 border-b border-line px-5">
          {(['create', 'saved'] as const).map(value => <button type="button" key={value} disabled={busy} aria-pressed={tab === value} onClick={() => setTab(value)}
            className={`border-b-2 py-3 text-sm ${tab === value ? 'border-brand-500 font-semibold text-ink' : 'border-transparent text-ink-soft'}`}>{value === 'create' ? 'Crear vídeo' : 'Vídeos guardados'}</button>)}
          <a className="ml-auto self-center text-sm text-ink-soft underline" href="/docs/videos/estudio/" target="_blank" rel="noreferrer">Guía</a>
        </nav>
        {tab === 'saved' && <VideoStudioMedia scope={scope} gallery revisionKey={savedKey} onBusyChange={setImageBusy} />}
        <div className={tab === 'create' ? 'flex min-h-0 flex-1 flex-col overflow-y-auto' : 'hidden'}>
          <div className="grid shrink-0 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            {VIDEO_GOALS.map(option => { const Icon = ICONS[option.id]; return <button type="button" key={option.id} disabled={busy} onClick={() => chooseGoal(option.id)} aria-pressed={goal === option.id}
              className={`flex gap-3 rounded-control border p-3 text-left transition-colors ${goal === option.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-surface-muted'}`}>
              <Icon size={20} className={goal === option.id ? 'mt-0.5 shrink-0 text-brand-600' : 'mt-0.5 shrink-0 text-ink-soft'} /><div><strong className="text-sm">{option.title}</strong><p className="mt-1 text-xs text-ink-soft">{option.description}</p></div>
            </button>; })}
          </div>
          {(goal === 'advertising' || goal === 'construction') && <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-4 lg:px-6"><span className="mr-2 text-sm font-medium">Material del vídeo</span>
            <Button variant={source === 'images' ? 'default' : 'outline'} size="sm" disabled={busy} onClick={() => setSource('images')}>Mis diseños</Button>
            <Button variant={source === 'model' ? 'default' : 'outline'} size="sm" disabled={busy} onClick={() => setSource('model')}>{goal === 'construction' ? 'Prueba del plano 3D' : '3D en parcela real'}</Button></div>}
          {constructionDesigns && <DesignConstructionPanel scope={scope} approved={Boolean(approved)} onReviewApproval={onReviewApproval} onBusyChange={setImageBusy} />}
          {imagesMode && !constructionDesigns && <><div className="px-5"><Button variant="outline" disabled={busy || approvalDisabled} onClick={onReviewApproval}>{approved ? 'Revisar aprobación' : 'Guardar y aprobar revisión'}</Button></div>
            <VideoStudioMedia scope={scope} gallery={false} revisionKey={savedKey} onBusyChange={setImageBusy} onReviewApproval={onReviewApproval} /></>}
          <div className={!imagesMode ? 'grid min-h-0 flex-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6 lg:pb-6' : 'hidden'}>
            <section className="flex min-h-[380px] flex-col overflow-hidden rounded-card border border-line bg-surface-muted lg:min-h-[470px]">
              <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
                <strong className="text-sm">{preview === 'result' ? 'Último vídeo creado' : preview === 'plan' ? 'Preparar recorrido' : 'Vista previa del modelo 3D'}</strong>
                <div className="flex gap-2"><Button size="sm" variant="outline" disabled={status.busy} onClick={() => { store.getState().setTool('select'); setPreview('scene'); }}>Vista 3D</Button>
                  {needsRoute && <Button size="sm" variant="outline" disabled={status.busy} onClick={editRoute}>Plano y recorrido</Button>}
                  {status.previewUrl && <Button size="sm" variant="outline" disabled={status.busy} onClick={() => setPreview('result')}>Ver vídeo</Button>}</div>
              </header>
              <div className="relative min-h-[330px] flex-1">
                <div className={preview === 'scene' ? 'absolute inset-0' : 'invisible absolute inset-0 pointer-events-none'}>
                  <EditorSceneView key={approvalCurrent ? approval?.id : 'draft'} store={previewStore} projectId={scope.projectId} videoStudio={sceneStudio}
                    lightingPreset={lighting} lightingLocked allowVideoExport={Boolean(approved)}
                    onSaveNativeVideo={approved && approval ? (blob, id, videoMode, presentation) => saveWalkthroughVideo(scope, approval.id, blob, id, videoMode, presentation?.contentScope, presentation) : undefined} />
                </div>
                {preview === 'plan' && <CanvasView store={store} fitOnMount onCenter={() => {}} />}
                {preview === 'result' && status.previewUrl && <div className="flex h-full min-h-80 items-center justify-center bg-black"><video src={status.previewUrl} controls playsInline className="max-h-[65vh] w-full" /></div>}
              </div>
              <p className="shrink-0 border-t border-line bg-surface px-4 py-3 text-xs text-ink-soft">Esta prueba utiliza la geometría y los muebles del editor. Para probar una construcción basada en tus imágenes, abre Construcción → Mis diseños. La visita continua fotorrealista sigue pendiente.</p>
            </section>
            <aside className="space-y-4 overflow-y-auto rounded-card border border-line bg-surface p-4">
              <div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-ink-soft">{readiness.durationMs ? `${Math.round(readiness.durationMs / 1000)} s · ` : ''}1080p · MP4 · sin consumo de IA</p></div>
              <fieldset disabled={status.busy} className="space-y-2 rounded-control border border-line p-3">
                <legend className="px-1 text-sm font-medium">Qué aparece en el vídeo</legend>
                <div className="flex gap-2">{(['house', 'all'] as const).map(value => <Button key={value} size="sm" variant={options.contentScope === value ? 'default' : 'outline'} aria-pressed={options.contentScope === value}
                  onClick={() => setOptions({ ...options, contentScope: value })}>{value === 'house' ? 'Solo la casa' : 'Todo el plano'}</Button>)}</div>
                <p className="text-xs text-ink-soft">{options.contentScope === 'house' ? 'Interiores y tejado; se excluyen jardín, piscina y objetos exteriores. El fondo es la parcela real si está confirmada.' : 'Incluye toda la geometría del plano, también parcela y exteriores.'}</p>
              </fieldset>
              <fieldset disabled={status.busy || readonly} className="space-y-3 rounded-control border border-line p-3">
                <legend className="px-1 text-sm font-medium">Preparar el diseño</legend>
                <p className="flex items-center gap-2 text-xs text-ink-soft"><Check size={14} />El plano aporta paredes, huecos y medidas.</p>
                <div className="flex flex-wrap gap-2 [&_button]:flex [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-control [&_button]:border [&_button]:border-line [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm">
                  <ExteriorRoofPanel store={store} onPreview={() => { store.getState().setCeilingView('solid'); setPreview('scene'); }} />
                  <GeographicSitePanel store={store} projectId={scope.projectId} readOnly={readonly} onReviewApproval={onReviewApproval} approvalDisabled={approvalDisabled} />
                </div>
                <p className="text-xs text-ink-soft">{document.exteriorRoof ? 'Tejado configurado en la planta activa.' : 'Sin tejado exterior en la planta activa; revisa la cubierta antes de grabar.'}</p>
                <p className="text-xs text-ink-soft">{document.geographicSite?.confirmed ? 'Encaje en parcela confirmado.' : 'Parcela real opcional: confirma el encaje para mostrar su fotografía como fondo.'}</p>
                <Button type="button" size="sm" variant="outline" disabled={approvalDisabled} onClick={onReviewApproval}>{approved ? 'Revisar aprobación' : 'Guardar y aprobar revisión'}</Button>
                <p className="text-xs text-ink-soft">{approved ? `Se grabará la revisión aprobada ${approval?.revision}.` : 'La vista previa muestra el borrador. Aprobar fija la versión y la luz del vídeo.'}</p>
              </fieldset>
              {needsRoute && <details open={preview === 'plan'} className="rounded-control border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium">Recorrido por las estancias</summary>
                <fieldset disabled={status.busy}><WalkthroughPanel store={store} videoStudio portalContainer={container}
                  onDraw={() => { editRoute(); store.getState().setTool('walkthrough'); }} onLocate={editRoute}
                  onPreview={() => { store.getState().setTool('select'); setPreview('scene'); previewStore.getState().setWalkthroughPlaying(true); }} /></fieldset>
              </details>}
              {routePlaying && <Button variant="outline" size="sm" onClick={() => previewStore.getState().setWalkthroughPlaying(false)}>Detener vista previa</Button>}
              <fieldset disabled={status.busy} className="space-y-3 rounded-control border border-line p-3">
                <legend className="px-1 text-sm font-medium">Acabado del vídeo</legend>
                {(mode === 'construction' || mode === 'showcase') && <VideoDurationControls value={options} combined={mode === 'showcase'}
                  onChange={value => setOptions({ ...value, contentScope: options.contentScope })} />}
                <label className="block text-sm">Luz<select aria-label="Luz del vídeo" className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2" value={lighting} onChange={event => onLightingChange(event.target.value as ApprovedLightingPreset)}>
                  {LIGHTING_PRESETS.map(value => <option key={value} value={value}>{LIGHTING_LABELS[value]}</option>)}</select></label>
                {mode !== 'walkthrough' && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.soundEffects} onChange={event => setOptions({ ...options, soundEffects: event.target.checked })} />Efectos de construcción</label>
                  {options.soundEffects && <label className="block text-xs">Volumen · {Math.round(options.soundVolume * 100)} %<input className="mt-2 w-full accent-brand-500" aria-label="Volumen de efectos" type="range" min={0} max={1} step={.05} value={options.soundVolume} onChange={event => setOptions({ ...options, soundVolume: Number(event.target.value) })} /></label>}
                  </>}
                <VideoDimensionControls value={options} onChange={value => setOptions({ ...value, contentScope: options.contentScope })} />
              </fieldset>
              <VideoPromptControls mode={mode} lighting={lighting} value={options} disabled={status.busy}
                onChange={value => setOptions({ ...value, contentScope: options.contentScope })} />
              {(approvalError || editorError) && <p role="alert" className="text-sm text-red-700">{approvalError || editorError}</p>}
              {status.busy ? <div className="space-y-2"><p role="status" className="text-sm">Creando vídeo · {Math.round(status.progress * 100)} %</p><progress className="w-full accent-brand-500" max={1} value={status.progress} /><Button variant="outline" onClick={() => control.current?.cancel()}>Cancelar creación</Button></div>
                : <><Button className="w-full" disabled={Boolean(exportIssue)} onClick={() => { setPreview('scene'); void control.current?.create(mode, options); }}><Play size={16} />Crear vídeo de {item.title.toLowerCase()}</Button>
                  {exportIssue && <p role="status" className="text-xs text-ink-soft">{exportIssue}</p>}</>}
              {status.message && <p role="status" className="text-sm">{status.message}</p>}
              {status.previewUrl && <Button variant="outline" className="w-full" disabled={status.busy} onClick={() => setPreview('result')}>Reproducir último vídeo</Button>}
            </aside>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
