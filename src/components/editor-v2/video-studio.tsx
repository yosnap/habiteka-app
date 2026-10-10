'use client';
import { useId, useRef, useState } from 'react';
import { Tabs } from 'radix-ui';
import { Clapperboard, FolderOpen, CircleHelp } from 'lucide-react';
import { ProjectWorkspace } from '@/components/app/project-workspace';
import type { EditorScope } from '@/server/editor/authority';
import type { ApprovedDesign, ApprovedLightingPreset } from '@/lib/editor-document/approved-design';
import type { VideoGoal } from '@/lib/editor-document/video-studio';
import { VideoCreationMenu } from './video-creation-menu';
import { VideoStudioMedia } from './video-studio-media';
import { DesignConstructionPanel } from './design-construction-panel';
import { PropertyVisitPanel } from './property-visit-panel';
import studio from './workspace/studio.module.css';
import { Button } from '@/components/ui/button';

interface Props {
  scope: EditorScope; projectName: string; approval: ApprovedDesign | null;
  approvalCurrent: boolean; approvalDisabled: boolean;
  lighting: ApprovedLightingPreset;
  onReviewApproval: () => void;
}

/** El plano aporta contexto; todo vídeo nuevo parte de diseños IA aceptados. */
export function VideoStudio(props: Props) {
  const { scope, approval, approvalCurrent, approvalDisabled, lighting, onReviewApproval } = props;
  const [goal, setGoal] = useState<Exclude<VideoGoal, 'combined'>>('construction');
  const [tab, setTab] = useState<'create' | 'saved'>('create');
  const [menuOpen, setMenuOpen] = useState(true);
  const menuId = useId();
  const createTab = useRef<HTMLButtonElement>(null);
  const savedTab = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<'images' | 'clip'>('images');
  const [busy, setBusy] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const approved = approvalCurrent && approval?.lightingPreset === lighting;
  const savedKey = approval?.id ?? '';
  function chooseGoal(value: Exclude<VideoGoal, 'combined'>) {
    if (busy) return;
    if (value !== 'advertising') setSource('images');
    setGoal(value);
    closeMenu();
  }
  function closeMenu() { setMenuOpen(false); createTab.current?.focus(); }
  function openSaved() { setMenuOpen(false); setTab('saved'); savedTab.current?.focus(); }
  function openAdvertising() { setMenuOpen(false); setGoal('advertising'); setSource('clip'); setTab('create'); createTab.current?.focus(); }
  return <Tabs.Root orientation="vertical" value={tab} onValueChange={value => { if (!busy) { setTab(value as typeof tab); setMenuOpen(value === 'create'); } }} asChild>
      <section ref={setContainer} aria-label="Estudio de vídeo"
        className={`${studio.video} flex min-h-0 flex-1 flex-col bg-surface text-ink [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50`}>
        <ProjectWorkspace label="Espacio de vídeos" rail={<>
          <Tabs.List aria-label="Estudio de vídeo">
            {(['create', 'saved'] as const).map(value => <Tabs.Trigger key={value} value={value} disabled={busy} ref={value === 'create' ? createTab : savedTab}
              aria-expanded={value === 'create' ? tab === 'create' && menuOpen : undefined}
              aria-details={value === 'create' && tab === 'create' && menuOpen ? menuId : undefined}
              onClick={() => { if (value === 'create' && !busy) setMenuOpen(true); }}
              >{value === 'create' ? <Clapperboard size={21} aria-hidden="true" /> : <FolderOpen size={21} aria-hidden="true" />}<span>{value === 'create' ? 'Crear vídeo' : 'Vídeos guardados'}</span></Tabs.Trigger>)}
          </Tabs.List>
        </>} footer={
          <a aria-label="Guía de vídeos (se abre en otra pestaña)" href={`${process.env.NODE_ENV === 'development' ? 'http://docs.localhost:3040' : 'https://docs.habiteka.app'}/videos/estudio/`} target="_blank" rel="noreferrer"><CircleHelp size={21} aria-hidden="true" />Guía</a>
        } panel={tab === 'create' && menuOpen ? <VideoCreationMenu id={menuId} goal={goal} busy={busy} onChoose={chooseGoal} onClose={closeMenu} /> : undefined}>
        <Tabs.Content value="saved" className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:outline-brand-500"><VideoStudioMedia scope={scope} gallery revisionKey={savedKey} onBusyChange={setBusy} onCreateAdvertising={openAdvertising} /></Tabs.Content>
        <Tabs.Content value="create" className="min-h-0 flex-1 overflow-y-auto">
          <div className={studio.stage}>
          <p className="px-5 pt-3 text-sm text-ink-soft">Crea a partir de tus diseños IA aceptados.</p>
          <details className="px-5 pt-2 text-xs text-ink-soft"><summary className="cursor-pointer">Guardado y límites</summary><p className="pt-2">Las tareas se conservan en Vídeos guardados. Los ajustes sin guardar se reinician al cambiar de pestaña. Construcción y primera persona son vídeos independientes: máximo 60 segundos y 2 € de generación por vídeo.</p></details>
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
          </div>
        </Tabs.Content>
        </ProjectWorkspace>
      </section>
    </Tabs.Root>;
}
