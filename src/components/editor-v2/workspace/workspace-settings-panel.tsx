'use client';

import { Download } from 'lucide-react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { VisibilityMenu, type EditorVisibility } from '../visibility-menu';
import { ImportProjectButton } from '@/components/app/import-project-button';
import ui from './workspace.module.css';

export function WorkspaceSettingsPanel({
  store,
  visibility,
  onVisibilityChange,
  shortcutsEnabled,
  onShortcutsChange,
  projectId,
  onExport,
}: {
  store: EditorStore;
  visibility: EditorVisibility;
  onVisibilityChange: (value: EditorVisibility) => void;
  shortcutsEnabled: boolean;
  onShortcutsChange: (value: boolean) => void;
  projectId?: string;
  onExport?: () => void;
}) {
  const snap = useStore(store, (s) => s.snap);
  return (
    <div className={ui.tools}>
      <p className={ui.eyebrow}>Vista y controles</p>
      <VisibilityMenu
        value={visibility}
        onChange={onVisibilityChange}
        shortcutsEnabled={shortcutsEnabled}
        onShortcutsChange={onShortcutsChange}
      />
      <button type="button" aria-pressed={snap} onClick={() => store.getState().setSnap(!snap)}>
        Ajuste a la geometría: {snap ? 'activo' : 'libre'}
      </button>
      <p className={ui.eyebrow}>Copias y exportación</p>
      <p className={ui.hint}>
        Los borradores locales y la recuperación siguen activos. Guarda los cambios antes de
        descargar la copia del servidor.
      </p>
      {projectId && (
        <a href={`/api/projects/${projectId}/export`} download>
          <Download size={18} aria-hidden="true" />
          Exportar proyecto .habiteka
        </a>
      )}
      {projectId && <ImportProjectButton />}
      {onExport && (
        <button type="button" onClick={onExport}>
          <Download size={18} aria-hidden="true" />
          Exportar plano
        </button>
      )}
      {!projectId && !onExport && (
        <p className={ui.hint}>
          La exportación del proyecto está disponible en los proyectos guardados.
        </p>
      )}
    </div>
  );
}
