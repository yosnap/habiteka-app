'use client';
import { isBoundaryKind } from '@/lib/editor-document/linear-boundary';
import dynamic from 'next/dynamic';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import type { QualityVerdict } from '@/lib/quality-verdict';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  Box,
  Download,
  LayoutGrid,
  Save,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import type { EditorSidePanel as SidePanelId, EditorStore, EditorTool } from '@/canvas/editor-v2/store';
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
import { addTerrainSurface, suggestedPavingSurface, suggestedTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { Inspector } from './inspector';
import { CatalogPanel } from './catalog-panel';
import { ConstructionMenu } from './construction-menu';
import { SelectionPropertiesBar } from './selection-properties-bar';
import { ElementDetailsPanel } from './element-details-panel';
import { walkthroughKeyframes } from '@/lib/editor-document/walkthrough-keyframes';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { sameCameraPose, type StoryboardGalleryImage } from '@/lib/contracts/storyboard-image';
import { setStoryboardImage } from '@/lib/editor-document/walkthrough-storyboard';
import { WalkthroughPanel } from './walkthrough-panel';
import { StoryboardPanel } from './storyboard-panel';
import { VisibilityMenu, type EditorVisibility } from './visibility-menu';
import { loadEditorPreferences, saveEditorPreferences } from './editor-preferences';
import { CeilingLightingPanel } from './ceiling-lighting-panel';
import { FloorFinishPanel } from './floor-finish-panel';
import { BuildingLevelMenu } from './building-level-menu';
import { SelectByKindMenu } from './select-by-kind-menu';
import { FurnitureContextPanel } from './furniture-context-panel';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { placeNewObject } from '@/canvas/editor-v2/spatial-placement';
import { RAMP_LANDING_CATALOG_ID } from '@/lib/editor-document/ramp-kind';
import { placeLandingAtRampArrival } from '@/lib/editor-document/ramp-landing-placement';
import { placeLandingAtStairArrival } from '@/lib/editor-document/stair-landing-placement';
import { EditorGenerateDialog } from './editor-generate-dialog';
import { usePlanIssueGate } from './plan-issues-panel';
import {
  roomInteriorCameras,
  selectedInteriorCameras,
} from '@/lib/editor-document/room-interior-cameras';
import type { AutoGenerateRequest } from './auto-generate-request';
import { useMountEffect } from '@/lib/use-mount-effect';
import { waitUntil } from '@/lib/async-wait';
import { isInteriorRenderMode, renderDesignOptionsSchema, zoneCompositeActive, type RenderDesignOptions, type RenderGeneratedResult } from '@/lib/editor-document/render-design-options';
import type { Estilo } from '@/lib/contracts';
import type { DesignSpaceKind } from '@/lib/design-space-kind';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { addDesignZone, removeDesignZone, renameDesignZone, reshapeDesignZone } from '@/lib/editor-document/design-zone-commands';
import styles from './editor.module.css';
import { plainShortcutFor, type EditorShortcutId } from '@/canvas/editor-v2/editor-shortcuts';
import { EditorSidePanel } from './editor-side-panel';
import type { PlanReference } from '@/lib/editor-document/plan-reference';
import type { SceneLightingPreset } from './scene/scene-lighting';

/** Título de cada panel dentro de la ranura lateral única. */
const SIDE_PANEL_TITLES: Record<SidePanelId, string> = {
  inspector: 'Propiedades', catalog: 'Amueblar', walkthrough: 'Recorrido',
  context: 'Contexto IA', ceiling: 'Techo y luces',
};

/** Plazo para que la escena 3D quede lista: aquí tarda decenas de segundos. */
const SCENE_READY_TIMEOUT_MS = 90_000;

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
  reference?: PlanReference | null;
  loadStoryboardImages?: () => Promise<StoryboardGalleryImage[]>;
  saveStatus?: string;
  onSave?: () => void;
  saveEnabled?: boolean;
  onApproveDesign?: () => void;
  approveDisabled?: boolean;
  approveLabel?: string;
  onOpenApproved?: () => void;
  onOpenApprovedRoute?: (routeId: string) => Promise<void>;
  onImport?: () => void;
  onExport?: () => void;
  onAddStair?: (kind: Stair['kind']) => void;
  projectId?: string;
  onSaveNativeVideo?: (blob: Blob, routeId: string, mode: NativeVideoMode) => Promise<void>;
  allowVideoExport?: boolean;
  lightingPreset?: SceneLightingPreset;
  onLightingChange?: (preset: SceneLightingPreset) => void;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onGenerateDesign?: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    options: RenderDesignOptions;
    qualityAck: boolean;
  }) => Promise<NativeDesignProposal>;
  onGenerateRender?: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    capture?: RenderCapture;
    options?: RenderDesignOptions;
    batchId?: string;
    qualityAck: boolean;
  }) => Promise<RenderGeneratedResult>;
  onEstimateRender?: (viewCount: number) => Promise<{ estimatedUsd: number; model: string }>;
  /** Evaluación de calidad del plano guardado que ve el diálogo al abrirse. */
  onEvaluateQuality?: () => Promise<QualityVerdict | null>;
  generateEnabled?: boolean;
  generateDisabledReason?: string;
  /** Arranque pedido por la URL: abre el diálogo de generación ya preparado. */
  autoGenerate?: AutoGenerateRequest | null;
}
export function EditorShell({
  store,
  projectName,
  reference,
  loadStoryboardImages,
  saveStatus,
  onSave,
  saveEnabled = true,
  onApproveDesign,
  approveDisabled = false,
  approveLabel = 'Aprobar diseño',
  onOpenApproved,
  onOpenApprovedRoute,
  onImport,
  onExport,
  onAddStair,
  projectId,
  onSaveNativeVideo,
  allowVideoExport,
  lightingPreset,
  onLightingChange,
  onSaveNativeRender,
  onGenerateDesign,
  onGenerateRender,
  onEstimateRender,
  onEvaluateQuality,
  generateEnabled = true,
  generateDisabledReason,
  autoGenerate = null,
}: EditorShellProps) {
  const past = useStore(store, (s) => s.past.length),
    future = useStore(store, (s) => s.future.length);
  const error = useStore(store, (s) => s.error),
    selection = useStore(store, (s) => s.selection);
  const designSpaceKind = useStore(store, (s) => s.document.designSpaceKind);
  const readOnly = useStore(store, (s) => s.readOnly);
  const tool = useStore(store, (s) => s.tool);
  const detailPanel = useStore(store, (s) => s.detailPanel);
  // Ranura lateral única: Propiedades, Catálogo, Recorrido, Contexto IA y Techo y
  // luces comparten sitio y solo uno está abierto. El estado vive en el store.
  const sidePanel = useStore(store, (s) => s.sidePanel);
  const [construction, setConstruction] = useState(false);
  const openPanel = useCallback((panel: SidePanelId) => {
    setConstruction(false);
    store.getState().openSidePanel(panel);
  }, [store]);
  const togglePanel = useCallback((panel: SidePanelId) => {
    setConstruction(false);
    store.getState().toggleSidePanel(panel);
  }, [store]);
  const closePanel = useCallback(() => store.getState().closeSidePanel(), [store]);
  const hideWalkthrough = () => store.getState().hideWalkthrough();
  // Vista y atajos se recuerdan entre recargas; el estado inicial se lee del navegador y cada cambio se guarda.
  const [preferences, setPreferences] = useState(loadEditorPreferences);
  const visibility = preferences.visibility, shortcutsEnabled = preferences.shortcutsEnabled;
  const setVisibility = (next: EditorVisibility) => setPreferences((current) => { const value = { ...current, visibility: next }; saveEditorPreferences(value); return value; });
  const setShortcutsEnabled = (next: boolean) => setPreferences((current) => { const value = { ...current, shortcutsEnabled: next }; saveEditorPreferences(value); return value; });
  const selectedLuminaire = useStore(store, (s) => (s.document.luminaires?.some((light) => s.selection.includes(light.id)) ?? false) || (s.document.ceilings?.some((ceiling) => s.selection.includes(ceiling.id)) ?? false));
  const [mode, setMode] = useState<'2d' | 'visual' | '3d'>('2d');
  const [localLighting, setLocalLighting] = useState<SceneLightingPreset>('daylight');
  const sceneLighting = lightingPreset ?? localLighting;
  // Las herramientas de trazado conservan el lienzo técnico; muebles y selección se editan en la maqueta cenital.
  useEffect(() => store.subscribe((next, previous) => {
    if (mode === 'visual' && next.tool !== previous.tool && next.tool !== 'select' && next.tool !== 'place-object') setMode('2d');
  }), [mode, store]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const planIssueGate = usePlanIssueGate(store, { close: () => setGenerateOpen(false), show2d: () => setMode('2d') });
  const [renderCapture, setRenderCapture] = useState<RenderCapture | undefined>();
  // La escena 3D se carga en diferido y tarda segundos: lo que dependa de ella
  // se espera, se informa y vence; nunca se queda colgado sin explicación.
  const [sceneReady, setSceneReady] = useState(false);
  const captureView = useRef<CaptureRenderView | null>(null);
  const captureDocument = useRef('');
  const keyframeCamera = useRef<ReturnType<typeof cameraPoseFromView> | null>(null);
  const keyframeTarget = useRef<{ routeId: string; waypointId: string } | null>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [preparingPoint, setPreparingPoint] = useState(false);
  const onCaptureReady = useCallback((capture: CaptureRenderView | null) => {
    captureView.current = capture;
    setSceneReady(Boolean(capture));
  }, []);
  /**
   * Única puerta a la escena 3D: conmuta a 3D si hace falta y espera a que la
   * vista avise de que puede capturar. Con plazo, porque cargar el 3D puede
   * fallar (WebGL perdido, modelo enorme) y entonces hay que decirlo.
   */
  const awaitScene = useCallback(async (): Promise<CaptureRenderView> => {
    if (!captureView.current) setMode('3d');
    await waitUntil(() => Boolean(captureView.current), {
      timeoutMs: SCENE_READY_TIMEOUT_MS,
      message: 'La vista 3D no terminó de cargar. Espera a que aparezca el modelo y vuelve a intentarlo.',
    });
    return captureView.current!;
  }, []);
  const previewRender = useCallback(async (options: Pick<RenderDesignOptions, 'lighting' | 'views'>) => {
    const capture = await awaitScene();
    const view = options.views[0] ?? 'current';
    return capture({ view, lighting: options.lighting, fit: view !== 'current',
      ...(keyframeCamera.current && view === 'current' ? { camera: keyframeCamera.current } : {}) });
  }, [awaitScene]);
  const documentGeometry = () => JSON.stringify({ ...store.getState().document, revision: 0, designSpaceKind: undefined });
  const designWalkthroughPoint = async (waypointId: string) => {
    if (preparingPoint) return;
    setPreparingPoint(true);
    try {
      const state = store.getState(), route = state.document.walkthroughs?.find((item) => item.id === state.walkthroughId);
      if (!route) throw new Error('Selecciona un recorrido.');
      const frame = walkthroughKeyframes(state.document, route).find((item) => item.waypointId === waypointId);
      if (!frame) throw new Error('El punto ya no existe.');
      const snapshot = documentGeometry();
      state.setWalkthroughPlaying(false); closePanel();
      const capture = await (await awaitScene())({ camera: frame.camera });
      if (snapshot !== documentGeometry()) throw new Error('El plano cambió. Vuelve a elegir el punto.');
      keyframeCamera.current = frame.camera;
      keyframeTarget.current = { routeId: route.id, waypointId };
      captureDocument.current = snapshot; setRenderCapture(capture); setGenerateOpen(true);
    } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo preparar la vista.'); }
    finally { setPreparingPoint(false); }
  };
  /**
   * Ruta única para abrir «Diseñar con IA», venga del botón (en 2D o en 3D) o
   * del asistente. El diálogo se abre siempre y de inmediato —también con el 3D
   * a medio cargar, que aquí tarda decenas de segundos— y él mismo enseña que
   * la escena sigue cargando; la captura de cortesía de la vista actual se
   * rellena en cuanto la escena avisa de que está lista.
   *
   * Que el diálogo espere en vez de bloquearse es lo que impide el «Preparando…»
   * eterno: toda espera pasa por `awaitScene`, que tiene plazo y mensaje.
   */
  const openGenerate = () => {
    keyframeCamera.current = null;
    keyframeTarget.current = null;
    setRenderCapture(undefined);
    setMode('3d');
    setGenerateOpen(true);
    void (async () => {
      try {
        const capture = await awaitScene();
        const snapshot = documentGeometry();
        const shot = await capture();
        if (snapshot !== documentGeometry()) return; // El plano cambió: sin captura de cortesía.
        captureDocument.current = snapshot;
        setRenderCapture(shot);
      } catch {
        // La captura de cortesía es un extra: el diálogo funciona sin ella y ya
        // indica si la escena no está lista. Un aviso rojo aquí solo estorba.
      }
    })();
  };
  /**
   * Llegada desde el asistente: misma ruta que el botón.
   *
   * La petición se borra de la URL nada más atenderla para que recargar no
   * vuelva a abrirla. Se hace con `history.replaceState` y no con
   * `router.replace` porque una navegación del App Router reejecuta el
   * componente de servidor, y eso reabre la rama de borrador de la sesión del
   * editor: limpiar la URL no puede costar el espacio de trabajo.
   */
  useMountEffect(() => {
    if (!autoGenerate || !projectId || !onGenerateRender) return;
    openGenerate();
    const url = new URL(window.location.href);
    url.searchParams.delete('generar');
    url.searchParams.delete('estilo');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  });

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
    closePanel();
    if (next !== 'select' && mode === '3d') setMode('visual');
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
    'valla-madera': 'Dibujar valla · clics por tramos · Esc para salir',
    'cerca-metal': 'Dibujar cerca · clics por tramos · Esc para salir',
    seto: 'Dibujar seto · clics por tramos · Esc para salir',
    walkthrough: 'Añadir puntos al recorrido',
    patio: 'Dibujar patio / terraza · clics para cerrar el contorno',
    kitchen: 'Dibujar mueble de cocina · clics por tramos pegados al muro · Esc para salir',
    select: 'Seleccionar',
    wall: 'Dibujar pared · clics por tramos · Esc para salir',
    'guard-wall': 'Dibujar murete · clics por tramos · Esc para salir',
    rectangle: 'Dibujar habitación',
    door: 'Colocar puerta',
    window: 'Colocar ventana',
    passage: 'Colocar hueco',
    measure: 'Medir distancia',
    'split-wall': 'Añadir esquina',
    'place-object': 'Colocar copia',
    'light-strip': 'Dibujar tira LED · clics por tramos · Esc para terminar',
    'light-zone': 'Dibujar zona de luces sobre el plano · Esc para salir',
  } satisfies Record<EditorTool, string>;
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !shortcutsEnabled ||
        (target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable))
      )
        return;
      const state = store.getState(),
        command = event.metaKey || event.ctrlKey;
      // Escape: deselecciona (cierra propiedades) y recoge los paneles laterales; el lienzo cancela además su trazo.
      if (event.key === 'Escape') {
        if (state.selection.length) state.select([]);
        setConstruction(false); state.closeSidePanel();
        return;
      }
      if (!command && !event.altKey) {
        const shortcut = plainShortcutFor(event.key);
        const toolByShortcut: Partial<Record<EditorShortcutId, EditorTool>> = {
          select: 'select', wall: 'wall', rectangle: 'rectangle', door: 'door', window: 'window', passage: 'passage', measure: 'measure',
        };
        const closePanels = () => { setConstruction(false); state.closeSidePanel(); };
        if (shortcut === 'furnish') { event.preventDefault(); if (readOnly) return; setConstruction(false); state.setTool('select'); state.openSidePanel('catalog'); return; }
        if (shortcut === 'construct') { event.preventDefault(); setConstruction((open) => !open); state.closeSidePanel(); state.setTool('select'); return; }
        if (shortcut === 'snap') { event.preventDefault(); state.setSnap(!state.snap); return; }
        if (shortcut === 'pan') { event.preventDefault(); state.setPan(!state.pan); return; }
        if (shortcut === 'fit') { event.preventDefault(); state.requestView('fit'); return; }
        if (shortcut === 'zoomIn') { event.preventDefault(); state.requestView('zoom-in'); return; }
        if (shortcut === 'zoomOut') { event.preventDefault(); state.requestView('zoom-out'); return; }
        const nextTool = shortcut ? toolByShortcut[shortcut] : undefined;
        if (nextTool) {
          event.preventDefault();
          if (readOnly && nextTool !== 'select') return;
          state.setTool(nextTool); closePanels();
          if (nextTool !== 'select' && mode === '3d') setMode('visual');
          return;
        }
      }
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
  }, [mode, readOnly, shortcutsEnabled, store]);
  return (
    <section className={styles.shell} data-mode={mode} onPointerDownCapture={(event) => {
      if (event.target instanceof HTMLCanvasElement) store.getState().setDetailAnchor({ x: event.clientX, y: event.clientY });
    }} aria-label={`Editor de ${projectName}`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <strong>{projectName}</strong>
          <span role="status">{saveStatus ?? 'Guardado no conectado'}</span>
        </div>
        <div className={styles.actions}>
          <BuildingLevelMenu store={store} />
          <VisibilityMenu value={visibility} onChange={setVisibility} shortcutsEnabled={shortcutsEnabled} onShortcutsChange={setShortcutsEnabled} />
          <SelectByKindMenu store={store} />
          <button type="button" data-side-panel-toggle aria-pressed={sidePanel === 'walkthrough'}
            onClick={() => { if (sidePanel === 'walkthrough') closePanel(); else openPanel('walkthrough'); }}>
            {sidePanel === 'walkthrough' ? 'Cerrar panel de recorrido' : 'Recorrido'}
          </button>
          <button type="button" data-side-panel-toggle aria-pressed={sidePanel === 'context'} onClick={() => togglePanel('context')}>Contexto IA</button>
          <button type="button" data-side-panel-toggle aria-pressed={sidePanel === 'ceiling'}
            onClick={() => { if (sidePanel === 'ceiling' && selectedLuminaire) store.getState().select([]); togglePanel('ceiling'); }}>Techo y luces</button>
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
            onClick={openGenerate}
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
          {onExport && <button
            type="button"
            onClick={onExport}
          >
            <Download size={18} aria-hidden="true" />
            <span>Exportar plano</span>
          </button>}
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
          {onApproveDesign && <button type="button" disabled={approveDisabled} onClick={onApproveDesign}>
            {approveLabel}
          </button>}
          {onOpenApproved && <button type="button" onClick={onOpenApproved}>Ver aprobado</button>}
        </div>
      </header>
      <div className={styles.secondary}>
        <div className={styles.viewSwitch} role="group" aria-label="Vista del espacio">
          <button type="button" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
            <Square size={16} aria-hidden="true" />
            Plano técnico
          </button>
          <button type="button" aria-pressed={mode === 'visual'} onClick={() => {
            setConstruction(false);
            setMode('visual');
          }}>
            <LayoutGrid size={16} aria-hidden="true" />
            Plano visual
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
              if (state.sidePanel === 'catalog') state.closeSidePanel();
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
              openPanel('inspector');
            })
          }
        >
          <Type size={18} aria-hidden="true" />
          Texto
        </button>
        <button
          type="button"
          data-side-panel-toggle
          aria-pressed={sidePanel === 'inspector'}
          aria-expanded={sidePanel === 'inspector'}
          onClick={() => togglePanel('inspector')}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Propiedades{selection.length ? ` (${selection.length})` : ''}
        </button>
      </div>
      {preparingPoint && <p role="status">Preparando la vista del recorrido…</p>}
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
          onTerrain={() => run(() => {
            const state = store.getState();
            if (state.readOnly) return;
            const surface = suggestedTerrainSurface(state.document, newId());
            state.apply(addTerrainSurface(state.document, surface));
            state.setTool('select'); state.select([surface.id]);
            setMode('visual'); openPanel('inspector');
          })}
          onPaving={() => run(() => {
            const state = store.getState();
            if (state.readOnly) return;
            const surface = suggestedPavingSurface(state.document, newId());
            state.apply(addTerrainSurface(state.document, surface));
            state.setTool('select'); state.select([surface.id]);
            setMode('visual'); openPanel('inspector');
          })}
          constructionOpen={construction}
          catalogOpen={sidePanel === 'catalog'}
          constructionButtonRef={constructionButton}
          onConstruction={() => {
            if (!construction) store.getState().setTool('select');
            setConstruction(!construction);
            closePanel();
          }}
          onCatalog={() => {
            if (sidePanel !== 'catalog') store.getState().setTool('select');
            togglePanel('catalog');
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
          <CanvasView store={store} onCenter={onCenter} active={mode === '2d'} fitOnMount
            presentation="technical" dimensions={visibility.dimensions}
            showFurniture={visibility.furniture} showWalls={visibility.walls} showLighting={visibility.lighting}
            reference={reference} />
        </div>
        {mode !== '2d' && (
          <div
            className={styles.sceneHost}
            onPointerDownCapture={() => {
              if (construction) setConstruction(false);
            }}
          >
            <EditorSceneView key={mode} store={store} presentation={mode === 'visual' ? 'plan' : 'spatial'} allowVideoExport={allowVideoExport}
              onOpenApprovedRoute={onOpenApprovedRoute}
              lightingPreset={sceneLighting} onLightingChange={(preset) => { setLocalLighting(preset); onLightingChange?.(preset); }}
              onSaveNativeVideo={onSaveNativeVideo} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady} showLighting={visibility.lighting} />
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
            onAddOutdoor={(item) => run(() => {
              if (store.getState().readOnly) return;
              if (isBoundaryKind(item.kind)) { chooseTool(item.kind); return; }
              // El elemento nuevo sigue al ratón y se coloca con un clic, igual que al pegar.
              const source = store.getState().document, next = upgradeSpatialDocument(addFurniture(source, item, center));
              if (mode === '3d') setMode('visual');
              store.getState().beginPlaceSpatial(next.furniture.at(-1)!);
            })}
          />
        )}
        {sidePanel && (
          <EditorSidePanel store={store} title={SIDE_PANEL_TITLES[sidePanel]}>
            {sidePanel === 'inspector' && <Inspector store={store} />}
            {sidePanel === 'catalog' && (
              <CatalogPanel
                readOnly={readOnly}
                onClose={closePanel}
                onAdd={(item) =>
                  run(() => {
                    if (store.getState().readOnly) return;
                    // El mueble sigue al ratón y se coloca donde se hace clic, en lugar de aparecer en un hueco libre cualquiera.
                    const source = store.getState().document,
                      next = upgradeSpatialDocument(addFurniture(source, item, center));
                    if (mode === '3d') setMode('visual');
                    store.getState().beginPlaceSpatial(next.furniture.at(-1)!);
                  })
                }
              />
            )}
            {sidePanel === 'walkthrough' && (
              <WalkthroughPanel store={store}
                onOpenApprovedRoute={onOpenApprovedRoute}
                onDesignPoint={!readOnly && generateEnabled && onGenerateRender ? (id) => void designWalkthroughPoint(id) : undefined}
                onDraw={() => { if (mode === '3d') setMode('visual'); store.getState().setTool('walkthrough'); }}
                onLocate={() => setMode('2d')}
                onPreview={() => { setMode('3d'); store.getState().setTool('select'); }} />
            )}
            {sidePanel === 'context' && <FurnitureContextPanel store={store} />}
            {sidePanel === 'ceiling' && <CeilingLightingPanel store={store} />}
          </EditorSidePanel>
        )}
        <div className={styles.storyboardHost}>
          <StoryboardPanel loadImages={loadStoryboardImages} imageRevision={imageRevision} store={store} onHide={hideWalkthrough} busy={preparingPoint || generateOpen}
            onDesignPoint={!readOnly && generateEnabled && projectId && onGenerateDesign && onGenerateRender ? (id) => void designWalkthroughPoint(id) : undefined} />
        </div>
      </div>
      <SelectionPropertiesBar
        store={store}
        onProperties={() => openPanel('inspector')}
      />
      <ElementDetailsPanel key={`${selection[0]}:${detailPanel}`} store={store} />
      {sidePanel !== 'ceiling' && <FloorFinishPanel store={store} />}
      {generateOpen && projectId && onGenerateDesign && onGenerateRender && (
        <EditorGenerateDialog
          document={store.getState().document}
          onGenerate={onGenerateDesign}
          capture={renderCapture}
          onPreview={previewRender}
          sceneReady={sceneReady}
          onEstimate={onEstimateRender}
          onEvaluateQuality={onEvaluateQuality}
          renderPlanIssues={planIssueGate}
          onPrepare={async (rawOptions) => {
            const options = renderDesignOptionsSchema.parse(rawOptions);
            // No se rechaza por «todavía no hay 3D»: se espera a que cargue, con
            // plazo. Quien llega del asistente pulsa antes de que termine.
            const capture = await awaitScene();
            const snapshot = documentGeometry();
            const captures: RenderCapture[] = [];
            // La máscara corresponde exactamente a esta cámara y permite auditar las zonas.
            const zoneMask = zoneCompositeActive(options)
              ? { maskRegions: options.regions.map((region) => region.polygon) } : {};
            // Vistas interiores: una captura por estancia con su cámara a altura
            // de ojos. La geometría va en la imagen; la IA solo pone el aspecto.
            if (isInteriorRenderMode(options)) {
              const rooms = selectedInteriorCameras(
                roomInteriorCameras(store.getState().document),
                options.interiorRoomIds,
              );
              if (!rooms.length) throw new Error('Elige al menos una estancia con muros cerrados.');
              for (const room of rooms) {
                captures.push(await capture({ lighting: options.lighting, camera: room.camera, ...zoneMask }));
                if (snapshot !== documentGeometry())
                  throw new Error('El plano cambió durante la preparación. Vuelve a preparar las vistas.');
              }
              captureDocument.current = snapshot;
              return captures;
            }
            for (const view of options.views) {
              captures.push(await capture({ view, lighting: options.lighting, fit: view !== 'current', ...zoneMask,
                ...(keyframeCamera.current && view === 'current' ? { camera: keyframeCamera.current } : {}) }));
              if (snapshot !== documentGeometry()) throw new Error('El plano cambió durante la preparación. Vuelve a preparar las vistas.');
            }
            captureDocument.current = snapshot;
            return captures;
          }}
          onRender={async (input) => {
            if ((input.capture || renderCapture) && captureDocument.current !== documentGeometry()) throw new Error('El plano cambió desde la captura. Cierra este diálogo y vuelve a capturar la vista.');
            const target = keyframeTarget.current, expectedCamera = keyframeCamera.current;
            const capture = input.capture ?? renderCapture;
            const snapshot = documentGeometry();
            const result = await onGenerateRender({ ...input, capture });
            setImageRevision((value) => value + 1);
            if (result.id && target && capture && expectedCamera && sameCameraPose(cameraPoseFromView(capture.view), expectedCamera)) {
              const state = store.getState();
              if (state.readOnly || snapshot !== documentGeometry()) {
                state.setError('La imagen se guardó en Diseños. El plano cambió durante la generación; elígela de la galería para asociarla.');
              } else {
                try {
                  state.apply(setStoryboardImage(state.document, target.routeId, { waypointId: target.waypointId, deliverableId: result.id, camera: expectedCamera }));
                  captureDocument.current = documentGeometry();
                } catch {
                  state.setError('La imagen se guardó en Diseños, pero no pudo asociarse a la vista.');
                }
              }
            }
            return result;
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
          onCreateDesignZone={(name, polygon) => {
            const state = store.getState();
            if (state.readOnly) throw new Error('Abre el borrador para dibujar zonas.');
            const next = addDesignZone(state.document, name, polygon);
            state.apply(next);
            return next.designZones!.at(-1)!.id;
          }}
          onRenameDesignZone={(id, name) => {
            const state = store.getState();
            if (state.readOnly) throw new Error('Abre el borrador para editar zonas.');
            state.apply(renameDesignZone(state.document, id, name));
          }}
          onReshapeDesignZone={(id, polygon) => {
            const state = store.getState();
            if (state.readOnly) throw new Error('Abre el borrador para editar zonas.');
            state.apply(reshapeDesignZone(state.document, id, polygon));
          }}
          onRemoveDesignZone={(id) => {
            const state = store.getState();
            if (state.readOnly) throw new Error('Abre el borrador para editar zonas.');
            state.apply(removeDesignZone(state.document, id));
          }}
          spaceKind={designSpaceKind}
          onSpaceKindChange={setSpaceKind}
          {...(autoGenerate
            ? {
                initialSetup: {
                  interiorRooms: autoGenerate.interiorRooms,
                  ...(autoGenerate.estilo ? { estilo: autoGenerate.estilo } : {}),
                },
              }
            : {})}
          onClose={() => setGenerateOpen(false)}
        />
      )}
    </section>
  );
}
