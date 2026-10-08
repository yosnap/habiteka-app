'use client';
import { useRef, useState } from 'react';
import { Tabs } from 'radix-ui';
import Link from 'next/link';
import { Clapperboard, Hammer, Footprints, Megaphone, ArrowLeft, Images } from 'lucide-react';
import type { EditorScope } from '@/server/editor/authority';
import type { ApprovedDesign, ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { VIDEO_GOALS, type VideoGoal } from '@/lib/editor-document/video-studio';
import { VideoStudioMedia } from './video-studio-media';
import { DesignConstructionPanel } from './design-construction-panel';
import { PropertyVisitPanel } from './property-visit-panel';
import { Button } from '@/components/ui/button';

const ICONS = { construction: Hammer, advertising: Megaphone, visit: Footprints, combined: Clapperboard };

interface Props {
  scope: EditorScope; projectName: string; approval: ApprovedDesign | null;
  approvalCurrent: boolean; approvalDisabled: boolean;
  lighting: ApprovedLightingPreset;
  onReviewApproval: () => void;
}

/** El plano aporta contexto; todo vídeo nuevo parte de diseños IA aceptados. */
export function VideoStudio(props: Props) {
  const { scope, projectName, approval, approvalCurrent, approvalDisabled, lighting, onReviewApproval } = props;
  const [goal, setGoal] = useState<Exclude<VideoGoal, 'combined'>>('construction');
  const [tab, setTab] = useState<'create' | 'saved'>('create');
  const createTab = useRef<HTMLButtonElement>(null);
  const savedTab = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<'images' | 'clip'>('images');
  const [busy, setBusy] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const approved = approvalCurrent && approval?.lightingPreset === lighting;
  const savedKey = approval?.id ?? '';
  const base = `/projects/${encodeURIComponent(scope.projectId)}`;
  const query = scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : '';
  function chooseGoal(value: Exclude<VideoGoal, 'combined'>) {
    if (value !== 'advertising') setSource('images');
    setGoal(value);
  }
  function openSaved() { setTab('saved'); savedTab.current?.focus(); }
  function openAdvertising() { setGoal('advertising'); setSource('clip'); setTab('create'); createTab.current?.focus(); }
  return <Tabs.Root value={tab} onValueChange={value => { if (!busy) setTab(value as typeof tab); }} asChild>
      <section ref={setContainer} aria-label="Estudio de vídeo"
        className="flex min-h-0 flex-1 flex-col bg-surface text-ink [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
        <header className="mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-4 px-5 py-6">
          <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Clapperboard size={24} className="text-brand-600" />Vídeos</h1>
            <p className="mt-1 text-sm text-ink-soft">{projectName} · crea a partir de tus diseños IA aceptados.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted" href={`${base}${query}`}><ArrowLeft size={16} />Volver al editor</Link>
            <Link className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted" href={`${base}/deliverables${query}`}><Images size={16} />Mis diseños</Link>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center gap-x-5 border-b border-line px-5">
          <Tabs.List aria-label="Estudio de vídeo" className="flex gap-5">
            {(['create', 'saved'] as const).map(value => <Tabs.Trigger key={value} value={value} disabled={busy} ref={value === 'create' ? createTab : savedTab}
              className="min-h-11 border-b-2 border-transparent py-3 text-sm text-ink-soft focus-visible:outline-2 focus-visible:outline-brand-500 data-[state=active]:border-brand-500 data-[state=active]:font-semibold data-[state=active]:text-ink">{value === 'create' ? 'Crear vídeo' : 'Vídeos guardados'}</Tabs.Trigger>)}
          </Tabs.List>
          <a aria-label="Guía de vídeos (se abre en otra pestaña)" className="ml-auto inline-flex min-h-11 items-center text-sm text-ink-soft underline focus-visible:outline-2 focus-visible:outline-brand-500" href={`${process.env.NODE_ENV === 'development' ? 'http://docs.localhost:3040' : 'https://docs.habiteka.app'}/videos/estudio/`} target="_blank" rel="noreferrer">Guía</a>
        </div>
        <Tabs.Content value="saved" className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:outline-brand-500"><VideoStudioMedia scope={scope} gallery revisionKey={savedKey} onBusyChange={setBusy} onCreateAdvertising={openAdvertising} /></Tabs.Content>
        <Tabs.Content value="create" className="flex min-h-0 flex-1 flex-col overflow-y-auto focus-visible:outline-2 focus-visible:outline-brand-500 data-[state=inactive]:hidden">
          <p className="mx-auto w-full max-w-6xl px-5 pt-4 text-xs text-ink-soft">Las tareas preparadas se conservan en Vídeos guardados. Los ajustes y vistas previas sin guardar se reinician al cambiar de pestaña.</p>
          <div className="mx-auto w-full max-w-6xl px-5 pt-6"><h2 className="mb-3 text-sm font-semibold">¿Qué vídeo quieres crear?</h2><div className="grid shrink-0 gap-3 sm:grid-cols-3">
            {VIDEO_GOALS.filter(option => option.id !== 'combined').map(option => { const Icon = ICONS[option.id]; return <button type="button" key={option.id} disabled={busy} onClick={() => chooseGoal(option.id)} aria-pressed={goal === option.id}
              className={`flex gap-3 rounded-control border p-3 text-left transition-colors ${goal === option.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-surface-muted'}`}>
              <Icon size={20} className={goal === option.id ? 'mt-0.5 shrink-0 text-brand-600' : 'mt-0.5 shrink-0 text-ink-soft'} /><div><strong className="text-sm">{option.title}</strong><p className="mt-1 text-xs text-ink-soft">{option.description}</p></div>
            </button>; })}
          </div><p className="mt-3 text-xs text-ink-soft">Construcción y recorrido se crean como vídeos independientes. Cada uno tiene un máximo de 60 segundos y 2 € de generación de vídeo.</p></div>
          {goal === 'advertising' && <div className="mx-auto mt-5 flex w-full max-w-6xl shrink-0 flex-wrap items-center gap-2 px-5"><span className="mr-2 text-sm font-medium">Material del vídeo</span>
            <Button variant={source === 'images' ? 'default' : 'outline'} aria-pressed={source === 'images'} size="sm" disabled={busy} onClick={() => setSource('images')}>Mis diseños</Button>
            <Button variant={source === 'clip' ? 'default' : 'outline'} aria-pressed={source === 'clip'} size="sm" disabled={busy} onClick={() => setSource('clip')}>Vídeo guardado</Button>
          </div>}
          {goal === 'construction' && <DesignConstructionPanel scope={scope} approved={Boolean(approved)} approvalDisabled={approvalDisabled} onReviewApproval={onReviewApproval} onBusyChange={setBusy} portalContainer={container}
            onOpenSaved={openSaved} onCreateAdvertising={openAdvertising} />}
          {goal === 'visit' && <PropertyVisitPanel key={`${scope.projectId}:${scope.zoneId ?? ''}:${approval?.id ?? ''}`} scope={scope} onBusyChange={setBusy} onReviewApproval={onReviewApproval} portalContainer={container} />}
          {goal === 'advertising' && <>{!approved && <div className="px-5"><Button variant="outline" disabled={busy || approvalDisabled} onClick={onReviewApproval}>Revisar versión del proyecto</Button></div>}
            <VideoStudioMedia scope={scope} gallery={false} clips={source === 'clip'} portalContainer={container} revisionKey={savedKey} onBusyChange={setBusy} onReviewApproval={onReviewApproval}
              onChooseImages={() => setSource('images')} onOpenSaved={openSaved} /></>}
        </Tabs.Content>
      </section>
    </Tabs.Root>;
}
