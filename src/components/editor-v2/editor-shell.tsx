'use client';
import dynamic from 'next/dynamic';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  Box,
  Download,
  Save,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import type { EditorStore, EditorTool } from '@/canvas/editor-v2/store';
import type { Point, Stair } from '@/lib/editor-document/schema';
import { addColumn, addRamp, addStair } from '@/lib/editor-document/construction-commands';
import {
  addFurniture,
  addWallPath,
  deleteEntities,
  editDocument,
  newId,
  nudgeSpatialEntities,
  repairLandingProtectionWalls,
  shapePoints,
} from '@/canvas/editor-v2/editing-operations';
import { selectableEntityIds } from '@/canvas/editor-v2/marquee-selection';
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
import { RAMP_LANDING_CATALOG_ID } from '@/lib/editor-document/ramp-kind';
import { placeLandingAtRampArrival } from '@/lib/editor-document/ramp-landing-placement';
import { placeLandingAtStairArrival } from '@/lib/editor-document/stair-landing-placement';
import { EditorGenerateDialog } from './editor-generate-dialog';
import { renderDesignOptionsSchema, type RenderDesignOptions, type RenderGeneratedResult } from '@/lib/editor-document/render-design-options';
import type { Estilo } from '@/lib/contracts';
import type { DesignSpaceKind } from '@/lib/design-space-kind';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import styles from './editor.module.css';

const CanvasView = dynamic(() => import('./canvas-view').then((module) => module.CanvasView), {
  ssr: false,
  loading: () => <div className={styles.loading}>Preparando el lienzo…</div>,
});
const EditorSceneView = dynamic(
  () => import('./scene/editor-scene-view').then((module) => module.EditorSceneView),
  { ssr: false, loading: () => <div className={styles.loading}>Preparando el espacio 3D…</div> },
);
export interface EditorShellProps {
  store: EditorStore;
  projectName: string;
  saveStatus?: string;
  onSave?: () => void;
  saveEnabled?: boolean;
  onImport?: () => void;
  onExport?: () => void;
  onAddStair?: (kind: Stair['kind']) => void;
  projectId?: string;
  onSaveNativeRender?: (captureDataUrl: string) => Promise<void>;
  onGenerateDesign?: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    options: RenderDesignOptions;
  }) => Promise<NativeDesignProposal>;
  onGenerateRender?: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    capture?: RenderCapture;
    options?: RenderDesignOptions;
    batchId?: string;
    referenceDesignId?: string;
  }) => Promise<RenderGeneratedResult>;
  onEstimateRender?: (viewCount: number) => Promise<{ estimatedUsd: number; model: string }>;
  generateEnabled?: boolean;
  generateDisabledReason?: string;
}
export function EditorShell({
  store,
  projectName,
  saveStatus,
  onSave,
  saveEnabled = true,
  onImport,
  onExport,
  onAddStair,
  projectId,
  onSaveNativeRender,
  onGenerateDesign,
  onGenerateRender,
  onEstimateRender,
  generateEnabled = true,
  generateDisabledReason,
}: EditorShellProps) {
  const past = useStore(store, (s) => s.past.length),
    future = useStore(store, (s) => s.future.length);
  const error = useStore(store, (s) => s.error),
    selection = useStore(store, (s) => s.selection);
  const designSpaceKind = useStore(store, (s) => s.document.designSpaceKind);
  const readOnly = useStore(store, (s) => s.readOnly);
  const tool = useStore(store, (s) => s.tool);
  const detailPanel = useStore(store, (s) => s.detailPanel);
  const [catalog, setCatalog] = useState(false),
    [inspector, setInspector] = useState(false);
  const [construction, setConstruction] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [renderCapture, setRenderCapture] = useState<RenderCapture | undefined>();
  const captureView = useRef<CaptureRenderView | null>(null);
  const captureDocument = useRef('');
  const onCaptureReady = useCallback((capture: CaptureRenderView | null) => { captureView.current = capture; }, []);
  const previewRender = useCallback(async (options: Pick<RenderDesignOptions, 'lighting' | 'views'>) => {
    if (!captureView.current) throw new Error('Abre la vista 3D para previsualizar el diseño.');
    return captureView.current({ view: options.views[0] ?? 'current', lighting: options.lighting, fit: true });
  }, []);
  const documentGeometry = () => JSON.stringify({ ...store.getState().document, revision: 0, designSpaceKind: undefined });
  const openGenerate = async () => {
    try {
      if (mode === '3d') {
        if (!captureView.current) throw new Error('Espera a que termine de cargar la vista 3D.');
        const snapshot = documentGeometry();
        const capture = await captureView.current();
        if (snapshot !== documentGeometry()) throw new Error('El plano cambió durante la captura. Vuelve a abrir Diseñar con IA.');
        captureDocument.current = snapshot;
        setRenderCapture(capture);
      } else setRenderCapture(undefined);
      setGenerateOpen(true);
    } catch (error) {
      store.getState().setError(error instanceof Error ? error.message : 'No se pudo capturar la vista.');
    }
  };
  const [center, setCenter] = useState<Point>({ x: 3000, y: 2000 });
  const constructionButton = useRef<HTMLButtonElement>(null),
    canvasHost = useRef<HTMLDivElement>(null);
  const onCenter = useCallback((point: Point) => setCenter(point), []);
  const run = (operation: () => void) => {
    try {
      operation();
    } catch (error) {
      store
        .getState()
        .setError(error instanceof Error ? error.message : 'No se pudo completar la edición.');
    }
  };
  const setSpaceKind = (spaceKind: DesignSpaceKind) => {
    if (store.getState().readOnly) return;
    store.getState().apply(setDesignSpaceKind(store.getState().document, spaceKind));
  };
  const repairLandingWalls = () =>
    run(() => {
      const state = store.getState();
      state.apply(repairLandingProtectionWalls(state.document));
      state.setError(null);
    });
  const closeConstruction = () => {
    setConstruction(false);
    constructionButton.current?.focus();
  };
  const chooseTool = (next: EditorTool) => {
    if (store.getState().readOnly && next !== 'select') return;
    store.getState().setTool(next);
    setConstruction(false);
    setCatalog(false);
    setInspector(false);
    if (next !== 'select') setMode('2d');
    canvasHost.current?.querySelector<HTMLElement>('[aria-label="Lienzo del plano"]')?.focus();
  };
  const insertStair = (kind: Stair['kind']) =>
    run(() => {
      if (store.getState().readOnly) return;
      chooseTool('select');
      if (onAddStair) {
        onAddStair(kind);
        return;
      }
      const id = newId(),
        dimensions =
          kind === 'straight'
            ? [1000, 3600, 2700]
            : kind === 'L'
              ? [2600, 2600, 2700]
              : [3000, 2160, 3040];
      const source = store.getState().document;
      const candidate = upgradeSpatialDocument(
        addStair(source, {
          id,
          kind,
          catalogId: `builtin:stairs-${kind}`,
          x: center.x - dimensions[0]! / 2,
          y: center.y - dimensions[1]! / 2,
          widthMm: dimensions[0]!,
          depthMm: dimensions[1]!,
          heightMm: dimensions[2]!,
          elevationMm: 0,
          rotation: 0,
          stepCount: 16,
          materialId: 'oak-natural',
        }),
      );
      store.getState().apply(placeNewObject(source, candidate, id));
      store.getState().select([id]);
    });
  const insertRamp = () =>
    run(() => {
      if (store.getState().readOnly) return;
      chooseTool('select');
      const id = newId(),
        source = store.getState().document;
      const candidate = addRamp(source, {
        id,
        catalogId: 'builtin:ramp-straight',
        x: center.x - 600,
        y: center.y - 7500,
        widthMm: 1200,
        depthMm: 15000,
        riseMm: 1200,
        elevationMm: 0,
        rotation: 0,
        materialId: 'concrete-grey',
      });
      store.getState().apply(placeNewObject(source, candidate, id));
      store.getState().select([id]);
    });
  const insertLanding = () =>
    run(() => {
      if (store.getState().readOnly) return;
      const prior = store.getState(),
        selectedRampId = prior.selection[0];
      chooseTool('select');
      const id = newId(),
        state = store.getState(),
        source = state.document;
      const landing = {
        id,
        catalogId: RAMP_LANDING_CATALOG_ID,
        x: center.x - 600,
        y: center.y - 600,
        widthMm: 1200,
        depthMm: 1200,
        riseMm: 0,
        elevationMm: 0,
        rotation: 0,
        materialId: 'concrete-grey',
      };
      const ramp = source.ramps?.find(
        (item) => item.id === selectedRampId && item.catalogId !== RAMP_LANDING_CATALOG_ID,
      );
      const stair = source.stairs?.find((item) => item.id === selectedRampId);
      const attached = ramp
        ? placeLandingAtRampArrival(landing, ramp)
        : stair
          ? placeLandingAtStairArrival(landing, stair)
          : landing;
      const candidate = addRamp(source, attached);
      state.apply(ramp || stair ? candidate : placeNewObject(source, candidate, id));
      state.select([id]);
    });
  const insertColumn = () =>
    run(() => {
      if (store.getState().readOnly) return;
      chooseTool('select');
      const id = newId(),
        source = store.getState().document;
      const candidate = addColumn(source, {
        id,
        catalogId: 'builtin:column-rectangular',
        x: center.x - 200,
        y: center.y - 200,
        widthMm: 400,
        depthMm: 400,
        heightMm: 2700,
        elevationMm: 0,
        rotation: 0,
        materialId: 'concrete-grey',
        color: '#a6a6a0',
      });
      store.getState().apply(candidate);
      store.getState().select([id]);
    });
  const toolLabel = {
    select: 'Seleccionar',
    wall: 'Dibujar paredes',
    'guard-wall': 'Dibujar murete de protección',
    rectangle: 'Dibujar habitación',
    door: 'Colocar puerta',
    window: 'Colocar ventana',
    passage: 'Colocar hueco',
    measure: 'Medir distancia',
    'split-wall': 'Añadir esquina',
    'place-object': 'Colocar copia',
  } satisfies Record<EditorTool, string>;
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        readOnly ||
        (target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable))
      )
        return;
      const state = store.getState(),
        command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'c' && state.selection.length === 1) {
        event.preventDefault();
        state.copySpatial(state.selection[0]!);
        return;
      }
      if (command && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        state.beginPasteSpatial();
        return;
      }
      if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        state.select(selectableEntityIds(state.document));
        return;
      }
      const delta =
        event.key === 'ArrowLeft'
          ? { x: -1, y: 0 }
          : event.key === 'ArrowRight'
            ? { x: 1, y: 0 }
            : event.key === 'ArrowUp'
              ? { x: 0, y: -1 }
              : event.key === 'ArrowDown'
                ? { x: 0, y: 1 }
                : null;
      if (delta && state.selection.length) {
        event.preventDefault();
        const stepMm = event.shiftKey ? 100 : 10;
        try {
          state.apply(
            nudgeSpatialEntities(state.document, state.selection, {
              x: delta.x * stepMm,
              y: delta.y * stepMm,
            }),
          );
        } catch (error) {
          state.setError(error instanceof Error ? error.message : 'No se pudo mover la selección.');
        }
        return;
      }
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || !state.selection.length) return;
      event.preventDefault();
      try {
        state.apply(deleteEntities(state.document, state.selection));
        state.select([]);
      } catch (error) {
        state.setError(
          error instanceof Error ? error.message : 'No se pudo eliminar la selección.',
        );
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [readOnly, store]);
  return (
    <section className={styles.shell} aria-label={`Editor de ${projectName}`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <strong>{projectName}</strong>
          <span role="status">{saveStatus ?? 'Guardado no conectado'}</span>
        </div>
        <div className={styles.actions}>
          <BuildingLevelMenu store={store} />
          <FurnitureContextPanel store={store} />
          <button
            type="button"
            disabled={readOnly || !past}
            onClick={() => store.getState().undo()}
            aria-label="Deshacer"
            title="Deshacer (⌘Z)"
          >
            <Undo2 size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={readOnly || !future}
            onClick={() => store.getState().redo()}
            aria-label="Rehacer"
            title="Rehacer (⇧⌘Z)"
          >
            <Redo2 size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={
              readOnly || !projectId || !onGenerateDesign || !onGenerateRender || !generateEnabled
            }
            onClick={() => void openGenerate()}
            title={
              generateDisabledReason ??
              (!onGenerateDesign
                ? 'Generación IA no disponible en este documento'
                : 'Generar diseño profesional desde este plano')
            }
          >
            <Sparkles size={18} aria-hidden="true" />
            <span>Diseñar con IA</span>
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!onExport}
            title={!onExport ? 'Exportación no disponible' : undefined}
          >
            <Download size={18} aria-hidden="true" />
            <span>Exportar</span>
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={onSave}
            disabled={readOnly || !onSave || !saveEnabled}
            title={!saveEnabled ? 'No hay cambios pendientes de guardar' : undefined}
          >
            <Save size={18} aria-hidden="true" />
            <span>Guardar</span>
          </button>
        </div>
      </header>
      <div className={styles.secondary}>
        <div className={styles.viewSwitch} role="group" aria-label="Vista del espacio">
          <button type="button" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
            <Square size={16} aria-hidden="true" />
            2D
          </button>
          <button
            type="button"
            aria-pressed={mode === '3d'}
            onClick={() => {
              const state = store.getState(),
                selectedIds = state.selection;
              state.setTool('select');
              state.select(selectedIds);
              setConstruction(false);
              setCatalog(false);
              setMode('3d');
            }}
          >
            <Box size={16} aria-hidden="true" />
            3D
          </button>
        </div>
        <span className={styles.currentTool} role="status">
          {readOnly ? 'Solo lectura' : toolLabel[tool]}
        </span>
        {tool !== 'select' && (
          <button type="button" onClick={() => chooseTool('select')}>
            <X size={16} aria-hidden="true" />
            Finalizar
          </button>
        )}
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            run(() => {
              const id = newId();
              store
                .getState()
                .apply(
                  editDocument(store.getState().document, (next) =>
                    next.labels.push({ id, ...center, text: 'Texto' }),
                  ),
                );
              store.getState().setTool('select');
              store.getState().select([id]);
              setInspector(true);
              setCatalog(false);
              setConstruction(false);
            })
          }
        >
          <Type size={18} aria-hidden="true" />
          Texto
        </button>
        <button
          type="button"
          aria-expanded={inspector}
          onClick={() => {
            setInspector(!inspector);
            setCatalog(false);
            setConstruction(false);
          }}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Propiedades{selection.length ? ` (${selection.length})` : ''}
        </button>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          {(error === 'Intersección de muros sin vértice compartido' ||
            error ===
              'El elemento atraviesa una pared u otro objeto. Ajusta posición, tamaño o elevación.') && (
            <button onClick={repairLandingWalls}>Reparar muretes del descansillo</button>
          )}
          <button onClick={() => store.getState().setError(null)}>Cerrar aviso</button>
        </div>
      )}
      <div className={styles.workspace}>
        <Toolbar
          store={store}
          constructionOpen={construction}
          catalogOpen={catalog}
          constructionButtonRef={constructionButton}
          onConstruction={() => {
            if (!construction) store.getState().setTool('select');
            setConstruction(!construction);
            setCatalog(false);
            setInspector(false);
          }}
          onCatalog={() => {
            if (!catalog) store.getState().setTool('select');
            setCatalog(!catalog);
            setConstruction(false);
            setInspector(false);
          }}
          onSelectTool={() => chooseTool('select')}
        />
        <div
          className={styles.canvasHost}
          hidden={mode !== '2d'}
          ref={canvasHost}
          onPointerDownCapture={() => {
            if (construction) setConstruction(false);
          }}
        >
          <CanvasView store={store} onCenter={onCenter} active={mode === '2d'} />
        </div>
        {mode === '3d' && (
          <div
            className={styles.sceneHost}
            onPointerDownCapture={() => {
              if (construction) setConstruction(false);
            }}
          >
            <EditorSceneView store={store} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady} />
          </div>
        )}
        {construction && (
          <ConstructionMenu
            readOnly={readOnly}
            onClose={closeConstruction}
            onImport={onImport}
            onTool={chooseTool}
            onShape={(shape) =>
              run(() => {
                if (store.getState().readOnly) return;
                store
                  .getState()
                  .apply(addWallPath(store.getState().document, shapePoints(shape, center), true));
                chooseTool('select');
              })
            }
            onAddStair={insertStair}
            onAddRamp={insertRamp}
            onAddLanding={insertLanding}
            onAddColumn={insertColumn}
          />
        )}
        <div
          className={styles.sidebar}
          data-open={inspector || catalog}
          style={catalog ? { width: 336 } : undefined}
        >
          {catalog ? (
            <CatalogPanel
              readOnly={readOnly}
              onClose={() => setCatalog(false)}
              onAdd={(item) =>
                run(() => {
                  if (store.getState().readOnly) return;
                  const source = store.getState().document,
                    next = upgradeSpatialDocument(addFurniture(source, item, center));
                  store.getState().apply(placeNewObject(source, next, next.furniture.at(-1)!.id));
                  store.getState().setTool('select');
                  store.getState().select([next.furniture.at(-1)!.id]);
                })
              }
            />
          ) : (
            <Inspector store={store} />
          )}
        </div>
      </div>
      <SelectionPropertiesBar
        store={store}
        onProperties={() => {
          setInspector(true);
          setCatalog(false);
          setConstruction(false);
        }}
      />
      <ElementDetailsPanel key={`${selection[0]}:${detailPanel}`} store={store} />
      <FloorFinishPanel store={store} />
      {generateOpen && projectId && onGenerateDesign && onGenerateRender && (
        <EditorGenerateDialog
          document={store.getState().document}
          onGenerate={onGenerateDesign}
          capture={renderCapture}
          onPreview={mode === '3d' ? previewRender : undefined}
          onEstimate={onEstimateRender}
          onPrepare={async (rawOptions) => {
            const options = renderDesignOptionsSchema.parse(rawOptions);
            if (mode !== '3d' || !captureView.current) throw new Error('Cierra este diálogo y cambia a 3D para preparar las vistas.');
            const snapshot = documentGeometry();
            const capture = captureView.current;
            const captures: RenderCapture[] = [];
            for (const view of options.views) {
              captures.push(await capture({ view, lighting: options.lighting, fit: true }));
              if (snapshot !== documentGeometry()) throw new Error('El plano cambió durante la preparación. Vuelve a preparar las vistas.');
            }
            captureDocument.current = snapshot;
            return captures;
          }}
          onRender={(input) => {
            if ((input.capture || renderCapture) && captureDocument.current !== documentGeometry()) throw new Error('El plano cambió desde la captura. Cierra este diálogo y vuelve a capturar la vista.');
            return onGenerateRender({ ...input, capture: input.capture ?? renderCapture });
          }}
          onApply={(proposal, selection) => {
            const state = store.getState();
            const next = applyNativeDesignProposal(state.document, proposal, selection);
            if (JSON.stringify({ ...next, revision: 0 }) === JSON.stringify({ ...state.document, revision: 0 })) {
              throw new Error('La selección no contiene cambios nuevos. Elige otros acabados o muebles.');
            }
            // El diálogo debe recibir el error: no cerrarlo si la validación rechaza la propuesta.
            state.apply(next);
          }}
          spaceKind={designSpaceKind}
          onSpaceKindChange={setSpaceKind}
          onClose={() => setGenerateOpen(false)}
        />
      )}
    </section>
  );
}
