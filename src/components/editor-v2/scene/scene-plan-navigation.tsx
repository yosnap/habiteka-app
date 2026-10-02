'use client';
import { Hand, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { shortcutHint } from '@/canvas/editor-v2/editor-shortcuts';
import styles from '../editor.module.css';

export function ScenePlanNavigation({ store }: { store: EditorStore }) {
  const pan = useStore(store, (state) => state.pan);
  return <div className={styles.navigation} aria-label="Navegación de Amueblado" data-side-panel-toggle>
    <button type="button" aria-label="Alejar" data-tooltip={shortcutHint('Alejar', 'zoomOut')}
      onClick={() => store.getState().requestView('zoom-out')}><ZoomOut size={18} aria-hidden="true" /></button>
    <button type="button" aria-label="Acercar" data-tooltip={shortcutHint('Acercar', 'zoomIn')}
      onClick={() => store.getState().requestView('zoom-in')}><ZoomIn size={18} aria-hidden="true" /></button>
    <button type="button" aria-label="Encuadrar" data-tooltip={shortcutHint('Encuadrar', 'fit')}
      onClick={() => store.getState().requestView('fit')}><Maximize size={18} aria-hidden="true" /></button>
    <button type="button" aria-label="Mano" aria-pressed={pan} data-tooltip={shortcutHint(pan ? 'Salir de mano' : 'Mano', 'pan')}
      onClick={() => store.getState().setPan(!pan)}><Hand size={18} aria-hidden="true" /></button>
  </div>;
}
