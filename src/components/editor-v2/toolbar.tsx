'use client';
import { useStore } from 'zustand';
import { BrickWall, Magnet, MousePointer2, Ruler, Sofa } from 'lucide-react';
import type { Ref } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import styles from './editor.module.css';
interface ToolbarProps {
  store: EditorStore;
  constructionOpen: boolean;
  catalogOpen: boolean;
  onConstruction: () => void;
  onCatalog: () => void;
  onSelectTool: () => void;
  constructionButtonRef?: Ref<HTMLButtonElement>;
}
export function Toolbar({ store, constructionOpen, catalogOpen, onConstruction, onCatalog, onSelectTool, constructionButtonRef }: ToolbarProps) {
  const tool = useStore(store, (s) => s.tool), snap = useStore(store, (s) => s.snap);
  const readOnly = useStore(store, (s) => s.readOnly);
  return <nav className={styles.tools} aria-label="Herramientas del plano">
    <button type="button" aria-pressed={tool === 'select' && !constructionOpen && !catalogOpen} onClick={onSelectTool}>
      <MousePointer2 size={22} aria-hidden="true" /><span>Seleccionar</span></button>
    <button type="button" ref={constructionButtonRef} aria-expanded={constructionOpen} aria-pressed={constructionOpen}
      onClick={onConstruction}><BrickWall size={22} aria-hidden="true" /><span>Construir</span></button>
    <button type="button" disabled={readOnly} aria-expanded={catalogOpen} aria-pressed={catalogOpen} onClick={onCatalog}>
      <Sofa size={22} aria-hidden="true" /><span>Amueblar</span></button>
    <button type="button" disabled={readOnly} aria-pressed={tool === 'measure'} onClick={() => { onSelectTool(); store.getState().setTool('measure'); }}>
      <Ruler size={22} aria-hidden="true" /><span>Medir</span></button>
    <button type="button" aria-pressed={snap} onClick={() => store.getState().setSnap(!snap)} title={snap ? 'Desactivar ajuste' : 'Activar ajuste'}>
      <Magnet size={20} aria-hidden="true" /><span>Ajuste {snap ? 'activo' : 'libre'}</span></button>
  </nav>;
}
