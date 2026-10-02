'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { Check, Clapperboard, Redo2, Save, Settings2, Sparkles, Undo2 } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { BuildingLevelMenu } from './building-level-menu';
import ui from './editor-project-bar.module.css';

interface Props {
  store: EditorStore; projectName: string; saveStatus?: string;
  onSave?: () => void; saveEnabled?: boolean;
  onGenerate: () => void; canGenerate: boolean; generateDisabledReason?: string;
  onOpenVideoStudio?: () => void; children: ReactNode;
}

/** Acciones frecuentes del proyecto; las herramientas de preparación se agrupan. */
export function EditorProjectBar({ store, projectName, saveStatus, onSave, saveEnabled,
  onGenerate, canGenerate, generateDisabledReason, onOpenVideoStudio, children }: Props) {
  const readOnly = useStore(store, state => state.readOnly);
  const past = useStore(store, state => state.past.length), future = useStore(store, state => state.future.length);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Element && !menu.current.contains(event.target)
        && !event.target.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) menu.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <header className={ui.bar}>
    <div className={ui.project}>
      <strong>{projectName}</strong>
      <span role="status">{saveStatus === 'Sincronizado' && <Check size={12} />}{saveStatus ?? 'Sin cambios guardados'}</span>
    </div>
    <div className={ui.floor}><BuildingLevelMenu store={store} /></div>
    <div className={ui.history} role="group" aria-label="Historial de edición">
      <button type="button" disabled={readOnly || !past} onClick={() => store.getState().undo()} aria-label="Deshacer" title="Deshacer (⌘Z)"><Undo2 size={18} /></button>
      <button type="button" disabled={readOnly || !future} onClick={() => store.getState().redo()} aria-label="Rehacer" title="Rehacer (⇧⌘Z)"><Redo2 size={18} /></button>
    </div>
    <div className={ui.actions}>
      <details ref={menu} className={ui.menu} onKeyDown={event => {
        if (event.key === 'Escape' && menu.current?.open) { event.stopPropagation(); menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
      }}>
        <summary><Settings2 size={18} /><span>Herramientas</span></summary>
        <div className={ui.menuPanel}><p>Preparar y revisar el proyecto</p><div className={ui.menuItems} onClick={event => {
          if (event.target instanceof Element && event.target.closest('[data-side-panel-toggle], [data-project-menu-action]') && menu.current) menu.current.open = false;
        }}>{children}</div></div>
      </details>
      <button type="button" className={ui.save} onClick={onSave} disabled={readOnly || !onSave || !saveEnabled} aria-label="Guardar" title={saveEnabled ? 'Guardar cambios' : 'Todos los cambios están guardados'}><Save size={18} /></button>
      {onOpenVideoStudio && <button type="button" className={ui.video} aria-label="Vídeos" title="Vídeos" onClick={onOpenVideoStudio}><Clapperboard size={18} /><span>Vídeos</span></button>}
      <button type="button" className={ui.primary} disabled={!canGenerate} onClick={onGenerate} title={generateDisabledReason}><Sparkles size={18} /><span>Diseñar con IA</span></button>
    </div>
  </header>;
}
