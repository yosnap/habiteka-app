'use client';
import { Box, LayoutGrid, Square } from 'lucide-react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { prepareViewChange, viewModeBlockedReason, type EditorViewMode } from '@/canvas/editor-v2/view-mode';
import styles from './editor.module.css';

const views = [
  { mode: '2d', label: 'Plano 2D', Icon: Square },
  { mode: 'visual', label: 'Amueblado', Icon: LayoutGrid },
  { mode: '3d', label: 'Modelo 3D', Icon: Box },
] as const;

export function EditorViewSwitch({ store, mode, onChange }: {
  store: EditorStore; mode: EditorViewMode; onChange: (mode: EditorViewMode) => void;
}) {
  const tool = useStore(store, (state) => state.tool);
  return <div className={styles.viewSwitch} role="group" aria-label="Vista del espacio" data-side-panel-toggle>
    {views.map(({ mode: next, label, Icon }) => {
      const reason = viewModeBlockedReason(tool, next);
      return <button key={next} type="button" aria-pressed={mode === next} disabled={Boolean(reason)} title={reason ?? undefined}
        onClick={() => { if (prepareViewChange(store, mode, next)) onChange(next); }}>
        <Icon size={16} aria-hidden="true" />{label}
      </button>;
    })}
  </div>;
}
