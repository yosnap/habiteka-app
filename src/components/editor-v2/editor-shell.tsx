'use client';
import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Box, Download, Save, SlidersHorizontal, Square, Type, Undo2, Redo2, X } from 'lucide-react';
import type { EditorStore, EditorTool } from '@/canvas/editor-v2/store';
import type { Point, Stair } from '@/lib/editor-document/schema';
import { addRamp, addStair } from '@/lib/editor-document/construction-commands';
import { addFurniture, addWallPath, deleteEntities, editDocument, newId, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { Toolbar } from './toolbar';
import { Inspector } from './inspector';
import { CatalogPanel } from './catalog-panel';
import { ConstructionMenu } from './construction-menu';
import { SelectionPropertiesBar } from './selection-properties-bar';
import { ElementDetailsPanel } from './element-details-panel';
import { FloorFinishPanel } from './floor-finish-panel';
import { BuildingLevelMenu } from './building-level-menu';
import { FurnitureContextPanel } from './furniture-context-panel';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { placeNewObject } from '@/canvas/editor-v2/spatial-placement';
import styles from './editor.module.css';

const CanvasView = dynamic(() => import('./canvas-view').then((module) => module.CanvasView),
  { ssr: false, loading: () => <div className={styles.loading}>Preparando el lienzo…</div> });
const EditorSceneView = dynamic(() => import('./scene/editor-scene-view').then((module) => module.EditorSceneView),
  { ssr: false, loading: () => <div className={styles.loading}>Preparando el espacio 3D…</div> });
export interface EditorShellProps {
  store: EditorStore;
  projectName: string;
  saveStatus?: string;
  onSave?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onAddStair?: (kind: Stair['kind']) => void;
}
export function EditorShell({ store, projectName, saveStatus, onSave, onImport, onExport, onAddStair }: EditorShellProps) {
  const past = useStore(store, (s) => s.past.length), future = useStore(store, (s) => s.future.length);
  const error = useStore(store, (s) => s.error), selection = useStore(store, (s) => s.selection);
  const readOnly = useStore(store, (s) => s.readOnly);
  const tool = useStore(store, (s) => s.tool);
  const detailPanel = useStore(store, (s) => s.detailPanel);
  const [catalog, setCatalog] = useState(false), [inspector, setInspector] = useState(false);
  const [construction, setConstruction] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [center, setCenter] = useState<Point>({ x: 3000, y: 2000 });
  const constructionButton = useRef<HTMLButtonElement>(null), canvasHost = useRef<HTMLDivElement>(null);
  const onCenter = useCallback((point: Point) => setCenter(point), []);
  const run = (operation: () => void) => {
    try { operation(); } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo completar la edición.'); }
  };
  const closeConstruction = () => { setConstruction(false); constructionButton.current?.focus(); };
  const chooseTool = (next: EditorTool) => {
    if (store.getState().readOnly && next !== 'select') return;
    store.getState().setTool(next); setConstruction(false); setCatalog(false); setInspector(false);
    if (next !== 'select') setMode('2d');
    canvasHost.current?.querySelector<HTMLElement>('[aria-label="Lienzo del plano"]')?.focus();
  };
  const insertStair = (kind: Stair['kind']) => run(() => {
    if (store.getState().readOnly) return;
    chooseTool('select');
    if (onAddStair) { onAddStair(kind); return; }
    const id = newId(), dimensions = kind === 'straight' ? [1000, 3600, 2700] : kind === 'L' ? [2600, 2600, 2700] : [3000, 2160, 3040];
    const source = store.getState().document;
    const candidate = upgradeSpatialDocument(addStair(source, { id, kind, catalogId: `builtin:stairs-${kind}`,
      x: center.x - dimensions[0]! / 2, y: center.y - dimensions[1]! / 2,
      widthMm: dimensions[0]!, depthMm: dimensions[1]!, heightMm: dimensions[2]!, elevationMm: 0,
      rotation: 0, stepCount: 16, materialId: 'oak-natural' }));
    store.getState().apply(placeNewObject(source, candidate, id));
    store.getState().select([id]);
  });
  const insertRamp = () => run(() => {
    if (store.getState().readOnly) return;
    chooseTool('select');
    const id = newId(), source = store.getState().document;
    const candidate = addRamp(source, { id, catalogId: 'builtin:ramp-straight', x: center.x - 600, y: center.y - 7500,
      widthMm: 1200, depthMm: 15000, riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    store.getState().apply(placeNewObject(source, candidate, id)); store.getState().select([id]);
  });
  const toolLabel = { select: 'Seleccionar', wall: 'Dibujar paredes', rectangle: 'Dibujar habitación',
    door: 'Colocar puerta', window: 'Colocar ventana', passage: 'Colocar hueco', measure: 'Medir distancia', 'split-wall': 'Añadir esquina' };
  return <section className={styles.shell} aria-label={`Editor de ${projectName}`} onKeyDown={(e) => {
    const target = e.target as HTMLElement;
    if (readOnly || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
    const state = store.getState();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); if (e.shiftKey) state.redo(); else state.undo();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!state.selection.length) return; e.preventDefault();
      run(() => state.apply(deleteEntities(state.document, state.selection))); state.select([]);
    }
  }}>
    <header className={styles.header}>
      <div className={styles.identity}><strong>{projectName}</strong><span role="status">{saveStatus ?? 'Guardado no conectado'}</span></div>
      <div className={styles.actions}>
        <BuildingLevelMenu store={store} />
        <FurnitureContextPanel store={store} />
        <button type="button" disabled={readOnly || !past} onClick={() => store.getState().undo()} aria-label="Deshacer"><Undo2 size={20} aria-hidden="true" /></button>
        <button type="button" disabled={readOnly || !future} onClick={() => store.getState().redo()} aria-label="Rehacer"><Redo2 size={20} aria-hidden="true" /></button>
        <button type="button" onClick={onExport} disabled={!onExport} title={!onExport ? 'Exportación no disponible' : undefined}><Download size={18} aria-hidden="true" /><span>Exportar</span></button>
        <button type="button" className={styles.primary} onClick={onSave} disabled={readOnly || !onSave}><Save size={18} aria-hidden="true" /><span>Guardar</span></button>
      </div>
    </header>
    <div className={styles.secondary}>
      <div className={styles.viewSwitch} role="group" aria-label="Vista del espacio">
        <button type="button" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}><Square size={16} aria-hidden="true" />2D</button>
        <button type="button" aria-pressed={mode === '3d'} onClick={() => {
          const state = store.getState(), selectedIds = state.selection;
          state.setTool('select'); state.select(selectedIds);
          setConstruction(false); setCatalog(false); setMode('3d');
        }}><Box size={16} aria-hidden="true" />3D</button>
      </div>
      <span className={styles.currentTool} role="status">{readOnly ? 'Solo lectura' : toolLabel[tool]}</span>
      {tool !== 'select' && <button type="button" onClick={() => chooseTool('select')}><X size={16} aria-hidden="true" />Finalizar</button>}
      <button type="button" disabled={readOnly} onClick={() => run(() => {
        const id = newId(); store.getState().apply(editDocument(store.getState().document,
          (next) => next.labels.push({ id, ...center, text: 'Texto' })));
        store.getState().setTool('select'); store.getState().select([id]); setInspector(true); setCatalog(false); setConstruction(false);
      })}><Type size={18} aria-hidden="true" />Texto</button>
      <button type="button" aria-expanded={inspector} onClick={() => { setInspector(!inspector); setCatalog(false); setConstruction(false); }}>
        <SlidersHorizontal size={18} aria-hidden="true" />Propiedades{selection.length ? ` (${selection.length})` : ''}
      </button>
    </div>
    {error && <div className={styles.error} role="alert"><span>{error}</span><button onClick={() => store.getState().setError(null)}>Cerrar aviso</button></div>}
    <div className={styles.workspace}>
      <Toolbar store={store} constructionOpen={construction} catalogOpen={catalog} constructionButtonRef={constructionButton}
        onConstruction={() => { if (!construction) store.getState().setTool('select'); setConstruction(!construction); setCatalog(false); setInspector(false); }}
        onCatalog={() => { if (!catalog) store.getState().setTool('select'); setCatalog(!catalog); setConstruction(false); setInspector(false); }}
        onSelectTool={() => chooseTool('select')} />
      <div className={styles.canvasHost} hidden={mode !== '2d'} ref={canvasHost} onPointerDownCapture={() => { if (construction) setConstruction(false); }}>
        <CanvasView store={store} onCenter={onCenter} active={mode === '2d'} />
      </div>
      {mode === '3d' && <div className={styles.sceneHost} onPointerDownCapture={() => { if (construction) setConstruction(false); }}><EditorSceneView store={store} /></div>}
      {construction && <ConstructionMenu readOnly={readOnly} onClose={closeConstruction} onImport={onImport}
        onTool={chooseTool} onShape={(shape) => run(() => {
          if (store.getState().readOnly) return;
          store.getState().apply(addWallPath(store.getState().document, shapePoints(shape, center), true)); chooseTool('select');
        })} onAddStair={insertStair} onAddRamp={insertRamp} />}
      <div className={styles.sidebar} data-open={inspector || catalog} style={catalog ? { width: 336 } : undefined}>
        {catalog ? <CatalogPanel readOnly={readOnly} onClose={() => setCatalog(false)} onAdd={(item) => run(() => {
          if (store.getState().readOnly) return;
          const source = store.getState().document, next = upgradeSpatialDocument(addFurniture(source, item, center));
          store.getState().apply(placeNewObject(source, next, next.furniture.at(-1)!.id)); store.getState().setTool('select');
          store.getState().select([next.furniture.at(-1)!.id]);
        })} /> : <Inspector store={store} />}
      </div>
    </div>
    <SelectionPropertiesBar store={store} onProperties={() => { setInspector(true); setCatalog(false); setConstruction(false); }} />
    <ElementDetailsPanel key={`${selection[0]}:${detailPanel}`} store={store} />
    <FloorFinishPanel store={store} />
  </section>;
}
