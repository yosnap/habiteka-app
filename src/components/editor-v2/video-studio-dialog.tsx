'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Clapperboard, Hammer, Footprints, Megaphone, X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorScope } from '@/server/editor/authority';
import type { ApprovedDesign, ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import { VIDEO_GOALS, type VideoGoal } from '@/lib/editor-document/video-studio';
import { VideoStudioMedia } from './video-studio-media';
import { DesignConstructionPanel } from './design-construction-panel';
import { Button } from '@/components/ui/button';

const ICONS = { construction: Hammer, advertising: Megaphone, visit: Footprints, combined: Clapperboard };

interface Props {
  store: EditorStore; scope: EditorScope; projectName: string; approval: ApprovedDesign | null;
  approvalCurrent: boolean; approvalDisabled: boolean; approvalError?: string | null;
  lighting: ApprovedLightingPreset; onLightingChange: (value: ApprovedLightingPreset) => void;
  onReviewApproval: () => void; onSave: () => void; onClose: () => void;
}

/** El plano aporta contexto; todo vídeo nuevo parte de diseños IA aceptados. */
export function VideoStudioDialog(props: Props) {
  const { scope, projectName, approval, approvalCurrent, approvalDisabled, lighting, onReviewApproval, onClose } = props;
  const [goal, setGoal] = useState<VideoGoal>('construction');
  const [tab, setTab] = useState<'create' | 'saved'>('create');
  const [source, setSource] = useState<'images' | 'clip'>('images');
  const [busy, setBusy] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const approved = approvalCurrent && approval?.lightingPreset === lighting;
  const savedKey = approval?.id ?? '';
  function chooseGoal(value: VideoGoal) {
    if (value !== 'advertising') setSource('images');
    setGoal(value);
  }
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
        {tab === 'saved' && <VideoStudioMedia scope={scope} gallery revisionKey={savedKey} onBusyChange={setBusy} />}
        <div className={tab === 'create' ? 'flex min-h-0 flex-1 flex-col overflow-y-auto' : 'hidden'}>
          <div className="grid shrink-0 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            {VIDEO_GOALS.map(option => { const Icon = ICONS[option.id]; return <button type="button" key={option.id} disabled={busy} onClick={() => chooseGoal(option.id)} aria-pressed={goal === option.id}
              className={`flex gap-3 rounded-control border p-3 text-left transition-colors ${goal === option.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-surface-muted'}`}>
              <Icon size={20} className={goal === option.id ? 'mt-0.5 shrink-0 text-brand-600' : 'mt-0.5 shrink-0 text-ink-soft'} /><div><strong className="text-sm">{option.title}</strong><p className="mt-1 text-xs text-ink-soft">{option.description}</p></div>
            </button>; })}
          </div>
          {goal === 'advertising' && <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-4 lg:px-6"><span className="mr-2 text-sm font-medium">Material del vídeo</span>
            <Button variant={source === 'images' ? 'default' : 'outline'} size="sm" disabled={busy} onClick={() => setSource('images')}>Mis diseños</Button>
            {goal === 'advertising' && <Button variant={source === 'clip' ? 'default' : 'outline'} size="sm" disabled={busy} onClick={() => setSource('clip')}>Vídeo guardado</Button>}
          </div>}
          {(goal === 'construction' || goal === 'visit') && <DesignConstructionPanel key={goal} goal={goal === 'visit' ? 'visit' : 'construction'} scope={scope} approved={Boolean(approved)} onReviewApproval={onReviewApproval} onBusyChange={setBusy} portalContainer={container} />}
          {goal === 'advertising' && <><div className="px-5"><Button variant="outline" disabled={busy || approvalDisabled} onClick={onReviewApproval}>{approved ? 'Revisar aprobación' : 'Guardar y aprobar revisión'}</Button></div>
            <VideoStudioMedia scope={scope} gallery={false} clips={source === 'clip'} portalContainer={container} revisionKey={savedKey} onBusyChange={setBusy} onReviewApproval={onReviewApproval} /></>}
          {goal === 'combined' && <section className="mx-auto w-full max-w-4xl space-y-4 p-6">
            <h2 className="text-xl font-semibold">Construcción y visita desde tus diseños</h2>
            <p className="text-sm text-ink-soft">La pieza combinada y la visita virtual continua aún no están disponibles sobre los diseños aceptados. El plano 3D es una guía y no se utiliza como sustituto.</p>
            <p className="text-sm">Puedes preparar por separado construcción y una toma interior desde imágenes IA aceptadas, y revisar cada resultado.</p>
            <div className="flex gap-2"><Button onClick={() => chooseGoal('construction')}>Construcción desde diseños</Button><Button variant="outline" onClick={() => chooseGoal('visit')}>Primera persona desde diseños</Button></div>
          </section>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
