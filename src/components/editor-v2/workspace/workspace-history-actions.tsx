'use client';
import { useStore } from 'zustand';
import { Redo2, Save, Undo2 } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { shortcutHint } from '@/canvas/editor-v2/editor-shortcuts';
import ui from './workspace.module.css';

export function WorkspaceHistoryActions({ store, onSave, saveEnabled, saveStatus }: {
  store: EditorStore; onSave?: () => void; saveEnabled?: boolean; saveStatus?: string;
}) {
  const readOnly = useStore(store, state => state.readOnly);
  const past = useStore(store, state => state.past.length), future = useStore(store, state => state.future.length);
  return <div className={ui.railHistory} role="group" aria-label="Guardar e historial">
    <button type="button" onClick={onSave} disabled={readOnly || !onSave || !saveEnabled} aria-label="Guardar"
      title={!onSave ? 'Guardado no disponible en esta muestra' : saveEnabled ? 'Guardar cambios' : saveStatus ?? 'Sin cambios pendientes'}>
      <Save size={19} aria-hidden="true" /><span>Guardar</span>
    </button>
    <div className={ui.historyArrows}>
      <button type="button" disabled={readOnly || !past} onClick={() => store.getState().undo()} aria-label="Deshacer" title={shortcutHint('Deshacer', 'undo')}><Undo2 size={18} /></button>
      <button type="button" disabled={readOnly || !future} onClick={() => store.getState().redo()} aria-label="Rehacer" title={shortcutHint('Rehacer', 'redo')}><Redo2 size={18} /></button>
    </div>
  </div>;
}
