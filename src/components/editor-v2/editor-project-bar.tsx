'use client';
import { Check } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { BuildingLevelMenu } from './building-level-menu';
import { ProjectNavigationMenu } from './project-navigation-menu';
import ui from './editor-project-bar.module.css';

interface Props {
  store: EditorStore; projectName: string; saveStatus?: string;
  projectId?: string; zoneId?: string | null;
}

/** Información del proyecto y planta, flotando sobre el lienzo. */
export function EditorProjectBar({ store, projectName, saveStatus, projectId, zoneId }: Props) {
  return <header className={ui.bar} data-workspace-project aria-label="Proyecto y planta">
    <div className={ui.project}>
      <strong title={projectName}>{projectName}</strong>
      <span role="status" title={saveStatus ?? 'Sin cambios guardados'}>{saveStatus === 'Sincronizado' && <Check size={12} />}{saveStatus ?? 'Sin cambios guardados'}</span>
    </div>
    <ProjectNavigationMenu projectName={projectName} projectId={projectId} zoneId={zoneId} />
    <div className={ui.floor}><BuildingLevelMenu store={store} /></div>
  </header>;
}
