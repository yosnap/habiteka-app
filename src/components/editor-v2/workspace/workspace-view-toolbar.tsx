'use client';

import { useRef } from 'react';
import { useStore } from 'zustand';
import { Magnet, MousePointer2, Ruler, SlidersHorizontal } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorViewMode } from '@/canvas/editor-v2/view-mode';
import { EditorViewSwitch } from '../editor-view-switch';
import ui from './workspace.module.css';

/** La vista y las herramientas rápidas flotan sobre la escena; el lateral solo contiene tareas. */
export function WorkspaceViewToolbar({
  store,
  mode,
  onViewChange,
  onSelect,
}: {
  store: EditorStore;
  mode: EditorViewMode;
  onViewChange: (mode: EditorViewMode) => void;
  onSelect: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const tool = useStore(store, (s) => s.tool);
  const snap = useStore(store, (s) => s.snap);
  const readOnly = useStore(store, (s) => s.readOnly);
  return (
    <div
      className={ui.viewToolbar}
      role="toolbar"
      aria-label="Vista y herramientas rápidas"
      data-side-panel-toggle
    >
      <EditorViewSwitch store={store} mode={mode} onChange={onViewChange} compact />
      <details
        ref={menu}
        className={ui.viewMenu}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menu.current?.open) {
            event.preventDefault();
            event.stopPropagation();
            menu.current.open = false;
            menu.current.querySelector('summary')?.focus();
          }
        }}
      >
        <summary aria-label="Herramientas rápidas" title="Seleccionar, medir y ajuste">
          <SlidersHorizontal size={17} aria-hidden="true" />
        </summary>
        <div className={`${ui.viewOptions} ${ui.quickTools}`}>
          <button
            type="button"
            aria-label="Seleccionar"
            title="Seleccionar · S"
            aria-pressed={tool === 'select'}
            onClick={() => {
              onSelect();
              if (menu.current) menu.current.open = false;
            }}
          >
            <MousePointer2 size={19} aria-hidden="true" /> Seleccionar
          </button>
          <button
            type="button"
            aria-label="Medir en el plano"
            title="Medir en el plano · M"
            disabled={readOnly}
            onClick={() => {
              onSelect();
              store.getState().setTool('measure');
              if (menu.current) menu.current.open = false;
            }}
          >
            <Ruler size={19} aria-hidden="true" /> Medir
          </button>
          <button
            type="button"
            aria-label={snap ? 'Desactivar ajuste' : 'Activar ajuste'}
            title="Ajuste a la geometría · A"
            aria-pressed={snap}
            onClick={() => store.getState().setSnap(!snap)}
          >
            <Magnet size={19} aria-hidden="true" /> Ajuste
          </button>
        </div>
      </details>
    </div>
  );
}
