'use client';
import { useStore } from 'zustand';
import { BrickWall, Magnet, MousePointer2, Ruler, Sofa, Trees } from 'lucide-react';
import type { Ref } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import styles from './editor.module.css';
import { shortcutHint } from '@/canvas/editor-v2/editor-shortcuts';
interface ToolbarProps {
  store: EditorStore;
  constructionOpen: boolean;
  catalogOpen: boolean;
  onConstruction: () => void;
  onCatalog: () => void;
  onSelectTool: () => void;
  onExterior: () => void;
  exteriorOpen: boolean;
  constructionButtonRef?: Ref<HTMLButtonElement>;
}
export function Toolbar({ store, constructionOpen, exteriorOpen, catalogOpen, onConstruction, onCatalog, onSelectTool, onExterior, constructionButtonRef }: ToolbarProps) {
  const tool = useStore(store, (s) => s.tool), snap = useStore(store, (s) => s.snap);
  const readOnly = useStore(store, (s) => s.readOnly);
  return <nav className={styles.tools} aria-label="Herramientas del plano">
    <button type="button" aria-pressed={tool === 'select' && !constructionOpen && !exteriorOpen && !catalogOpen} onClick={onSelectTool} data-tooltip={shortcutHint('Seleccionar', 'select')}>
      <MousePointer2 size={22} aria-hidden="true" /><span>Seleccionar</span></button>
    <button type="button" ref={constructionButtonRef} aria-expanded={constructionOpen} aria-pressed={constructionOpen}
      onClick={onConstruction} data-tooltip={shortcutHint('Construir', 'construct')}><BrickWall size={22} aria-hidden="true" /><span>Construir</span></button>
    <button type="button" disabled={readOnly} data-side-panel-toggle aria-expanded={catalogOpen} aria-pressed={catalogOpen} onClick={onCatalog} data-tooltip={shortcutHint('Amueblar', 'furnish')}>
      <Sofa size={22} aria-hidden="true" /><span>Amueblar</span></button>
    <button type="button" aria-pressed={exteriorOpen} aria-expanded={exteriorOpen} onClick={onExterior} title="Terreno, jardín y elementos exteriores">
      <Trees size={22} aria-hidden="true" /><span>Exterior</span></button>
    <button type="button" disabled={readOnly} aria-pressed={tool === 'measure'} onClick={() => { onSelectTool(); store.getState().setTool('measure'); }} data-tooltip={shortcutHint('Crear una cota: arrastra entre dos puntos', 'measure')}>
      <Ruler size={22} aria-hidden="true" /><span>Medir</span></button>
    <button type="button" aria-pressed={snap} onClick={() => store.getState().setSnap(!snap)} data-tooltip={shortcutHint(snap ? 'Desactivar ajuste' : 'Activar ajuste', 'snap')}>
      <Magnet size={20} aria-hidden="true" /><span>Ajuste {snap ? 'activo' : 'libre'}</span></button>
  </nav>;
}
