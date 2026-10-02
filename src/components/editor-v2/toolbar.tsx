'use client';
import { useStore } from 'zustand';
import { BrickWall, Grid3X3, Magnet, MousePointer2, Ruler, Sofa, Sprout } from 'lucide-react';
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
  onTerrain: () => void;
  onPaving: () => void;
  constructionButtonRef?: Ref<HTMLButtonElement>;
}
export function Toolbar({ store, constructionOpen, catalogOpen, onConstruction, onCatalog, onSelectTool, onTerrain, onPaving, constructionButtonRef }: ToolbarProps) {
  const tool = useStore(store, (s) => s.tool), snap = useStore(store, (s) => s.snap);
  const readOnly = useStore(store, (s) => s.readOnly);
  return <nav className={styles.tools} aria-label="Herramientas del plano">
    <button type="button" aria-pressed={tool === 'select' && !constructionOpen && !catalogOpen} onClick={onSelectTool} data-tooltip={shortcutHint('Seleccionar', 'select')}>
      <MousePointer2 size={22} aria-hidden="true" /><span>Seleccionar</span></button>
    <button type="button" ref={constructionButtonRef} aria-expanded={constructionOpen} aria-pressed={constructionOpen}
      onClick={onConstruction} data-tooltip={shortcutHint('Construir', 'construct')}><BrickWall size={22} aria-hidden="true" /><span>Construir</span></button>
    <button type="button" disabled={readOnly} data-side-panel-toggle aria-expanded={catalogOpen} aria-pressed={catalogOpen} onClick={onCatalog} data-tooltip={shortcutHint('Amueblar', 'furnish')}>
      <Sofa size={22} aria-hidden="true" /><span>Amueblar</span></button>
    <button type="button" disabled={readOnly} onClick={onTerrain} title="Añadir suelo exterior editable al proyecto">
      <Sprout size={22} aria-hidden="true" /><span>Terreno</span></button>
    <button type="button" disabled={readOnly} onClick={onPaving} title="Añadir pavimento exterior visual editable; no habilita el recorrido">
      <Grid3X3 size={22} aria-hidden="true" /><span>Pavimento</span></button>
    <button type="button" disabled={readOnly} aria-pressed={tool === 'measure'} onClick={() => { onSelectTool(); store.getState().setTool('measure'); }} data-tooltip={shortcutHint('Medir', 'measure')}>
      <Ruler size={22} aria-hidden="true" /><span>Medir</span></button>
    <button type="button" aria-pressed={snap} onClick={() => store.getState().setSnap(!snap)} data-tooltip={shortcutHint(snap ? 'Desactivar ajuste' : 'Activar ajuste', 'snap')}>
      <Magnet size={20} aria-hidden="true" /><span>Ajuste {snap ? 'activo' : 'libre'}</span></button>
  </nav>;
}
