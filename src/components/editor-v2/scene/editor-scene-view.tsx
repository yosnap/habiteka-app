'use client';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Canvas, type RootState } from '@react-three/fiber';
import { flushSync } from 'react-dom';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { Bounds, Edges, Html } from '@react-three/drei';
import { Vector3, PerspectiveCamera } from 'three';
import { cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { BoxMesh, PolygonMesh, RampMesh } from './scene-meshes';
import { SceneCamera, type CameraRequest } from './scene-camera';
import { scenePresetFocus } from './scene-preset-focus';
import { CutawayWall, hideWallsFacingCamera, revealHiddenLighting } from './cutaway-wall';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { buildingStairLinks } from '@/lib/editor-document/building-stair-links';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { FurnitureModel } from './furniture-model';
import { OutdoorLighting } from './outdoor-lighting';
import { WalkCamera } from './walk-camera';
import { FreeWalkCamera } from './free-walk-camera';
import { walkOpenFocus } from './free-walk-input';
import { FreeWalkController } from './free-walk-controller';
import { FreeWalkOverlay } from './free-walk-overlay';
import { freeWalkStart } from '@/lib/editor-document/free-walk-navigation';
import { buildingWalkNavigation } from '@/lib/editor-document/building-free-walk';
import { recordWalkthrough } from './offline-recorder';
import { nativeVideoDurationIssue, type NativeVideoMode } from '@/lib/editor-document/native-video';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { SceneLighting, SCENE_LIGHTING_LABELS, type SceneLightingPreset } from './scene-lighting';
import { SceneEnvironment } from './scene-environment';
import { SceneGround } from './scene-ground';
import { CeilingLightingMeshes } from './ceiling-lighting-meshes';
import { captureCeilingView, captureCutaway, levelLightBudgets, lightingCoverage, type BudgetLevel, type CeilingView } from './ceiling-scene-utils';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { resolvedStrips } from '@/lib/editor-document/light-strip-geometry';
import { resolvedLuminaires, ceilingSurfaces, hasCompleteInteriorRoof, ceilingIssues as computeCeilingIssues, type CeilingIssue } from '@/lib/editor-document/ceiling-geometry';
import { SceneViewControls, type SceneViewAction, type SceneViewPreset } from './scene-view-controls';
import { withTimeout } from '@/lib/async-wait';
import { renderZoneMask } from './zone-mask';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { placeOnHost } from '@/lib/editor-document/object-host-rest';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { ScenePlanContextMenu } from './scene-plan-context-menu';
import {
  beginPlanDrag, finishPlanDrag, planDragPosition, positionedPending, sceneEntityId, scenePlanPoint,
  type PlanDrag, type PlanMovePreview,
} from './scene-plan-interaction';

const unavailable = <div role="alert" style={{ padding: 24 }}>No se puede mostrar WebGL. Tu plano sigue disponible en 2D.</div>;
const MAX_PERSISTED_RENDER_SIDE = 2048;
/**
 * Plazo de una captura. Las capturas se encolan, así que una que se quedara
 * esperando un fotograma que no llega bloquearía TODAS las siguientes y el
 * diálogo se quedaría en «Preparando…» para siempre. Con plazo, la cola avanza
 * y el usuario lee qué ha pasado.
 */
const CAPTURE_TIMEOUT_MS = 45_000;
type SceneCapture = RenderCapture & { downloadDataUrl?: string };
type CaptureScene = (options?: Parameters<CaptureRenderView>[0], fullResolution?: boolean) => Promise<SceneCapture>;

/** Ajusta la copia destinada al servidor al mismo techo que valida el saneador. */
function captureForPersistence(canvas: HTMLCanvasElement): string {
  const largestSide = Math.max(canvas.width, canvas.height);
  if (largestSide <= MAX_PERSISTED_RENDER_SIDE) return canvas.toDataURL('image/png');

  const scale = MAX_PERSISTED_RENDER_SIDE / largestSide;
  const copy = window.document.createElement('canvas');
  copy.width = Math.round(canvas.width * scale);
  copy.height = Math.round(canvas.height * scale);
  const context = copy.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la copia del render para guardarla.');
  context.drawImage(canvas, 0, 0, copy.width, copy.height);
  return copy.toDataURL('image/png');
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div role="alert" style={{ padding: 24 }}>No se pudo mostrar la escena 3D. El documento no se ha modificado; puedes continuar en 2D.</div> : this.props.children; }
}
function SceneView({
  store,
  presentation = 'spatial',
  allowVideoExport = true,
  onOpenApprovedRoute,
  lightingPreset = 'daylight',
  onLightingChange,
  lightingLocked = false,
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
  showLighting = true,
  showNotices = true,
  readOnlyLabel = 'Diseño aprobado · vista cenital de la misma escena 3D',
}: {
  store: EditorStore;
  presentation?: 'plan' | 'spatial';
  allowVideoExport?: boolean;
  onOpenApprovedRoute?: (routeId: string) => Promise<void>;
  lightingPreset?: SceneLightingPreset;
  onLightingChange?: (preset: SceneLightingPreset) => void;
  lightingLocked?: boolean;
  onSaveNativeVideo?: (blob: Blob, routeId: string, mode: NativeVideoMode) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
  showLighting?: boolean;
  showNotices?: boolean;
  readOnlyLabel?: string;
}) {
  const document = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const pendingSpatial = useStore(store, (s) => s.pendingSpatial);
  const ceilingView = useStore(store, (s) => s.ceilingView);
  const [captureCeilings, setCaptureCeilings] = useState<CeilingView | null>(null);
  const stairLinks = useMemo(() => buildingStairLinks(document), [document]);
  const scene = useMemo(() => editorDocumentToScene(document,
    stairLinks.filter((link) => link.upperLevelId === document.activeLevelId).map((link) => link.outline)), [document, stairLinks]);
  const openingHosts = useMemo(() => new Map(document.openings.map((opening) => [opening.id, opening.wallId])), [document]);
  const modeled = useMemo(() => new Set(document.furniture.filter((item) => furnitureAsset(item)).map((item) => item.id)), [document]);
  const [request, setRequest] = useState<CameraRequest>({ sequence: 0, action: presentation === 'plan' ? 'top' : 'fit' });
  const [activeView, setActiveView] = useState<SceneViewPreset | null>(presentation === 'plan' ? 'top' : null);
  const routeId = useStore(store, (s) => s.walkthroughId);
  const walking = useStore(store, (s) => s.walkthroughPlaying);
  const [freeWalk, setFreeWalk] = useState<{ start: { x: number; y: number }; focus: [number, number, number] } | null>(null);
  const [walkPaused, setWalkPaused] = useState(false);
  const [walkViewMode, setWalkViewMode] = useState<'first' | 'third'>('first');
  const toggleWalkView = useCallback(() => setWalkViewMode((mode) => mode === 'first' ? 'third' : 'first'), []);
  const [freeWalkController] = useState(() => new FreeWalkController());
  const route = document.walkthroughs?.find((path) => path.id === routeId);
  const routeExport = useMemo(() => {
    if (!route || presentation !== 'spatial') return null;
    try {
      const compiled = buildWalkthrough(document, route);
      const blocked = compiled.invalidSegments.length
        ? `Hay tramos bloqueados (${compiled.invalidSegments.map((index) => `${index + 1}–${index + 2}`).join(', ')}). Corrígelos en el editor y aprueba otra revisión.` : null;
      return {
        durationMs: compiled.durationMs,
        walkthroughIssue: blocked ?? nativeVideoDurationIssue(compiled.durationMs, 'walkthrough'),
        showcaseIssue: blocked ?? (!document.vertices.length ? 'Dibuja el inmueble antes de crear el vídeo de construcción.'
          : nativeVideoDurationIssue(compiled.durationMs, 'showcase')),
      };
    } catch (error) {
      const issue = error instanceof Error ? error.message : 'No se pudo comprobar el recorrido.';
      return { durationMs: 0, walkthroughIssue: issue, showcaseIssue: issue };
    }
  }, [document, presentation, route]);
  const [capturingPose, setCapturingPose] = useState(false);
  const [recording, setRecording] = useState(false), [recordProgress, setRecordProgress] = useState(0);
  const abortRecording = useRef<AbortController | null>(null);
  useEffect(() => () => { abortRecording.current?.abort(); store.getState().setWalkthroughPlaying(false); }, [store]);
  const [contextLost, setContextLost] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  // La vista oblicua abre el interior; la cenital conserva todo el perímetro.
  const [cutaway, setCutaway] = useState(presentation === 'spatial');
  // Estancia en la que está la cámara. Es estado de la vista 3D, no del documento.
  const [interiorRoomId, setInteriorRoomId] = useState<string | null>(null);
  const [allLevels, setAllLevels] = useState(false);
  const multiLevelRoute = Boolean(route?.waypoints.some((point) => point.levelId));
  const renderAllLevels = allLevels || (multiLevelRoute && (walking || recording));
  const activeElevation = renderAllLevels ? buildingDocuments(document).find((level) => level.id === document.activeLevelId)?.elevationMm ?? 0 : 0;
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  // Avisos de construcción (suelo sin cerrar, techos, luces) como notificación con cierre; reaparece si cambian.
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const [captureLighting, setCaptureLighting] = useState<SceneLightingPreset | null>(null);
  const lighting = captureLighting ?? lightingPreset;
  const lightingRef = useRef(lighting);
  useEffect(() => { lightingRef.current = lighting; }, [lighting]);
  const interiorCameras = useMemo(() => roomInteriorCameras(document), [document]);
  const [planMenu, setPlanMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => store.subscribe((next, previous) => {
    if (next.document !== previous.document) { setFreeWalk(null); setPlanMenu(null); }
  }), [store]);
  const pauseFreeWalk = useCallback(() => {
    setWalkPaused(true);
    freeWalkController.stop();
    if (window.document.pointerLockElement) window.document.exitPointerLock();
  }, [freeWalkController]);
  const enterFreeWalk = () => {
    const nav = buildingWalkNavigation(document).navs.get(document.activeLevelId ?? 'ground')!;
    const selected = interiorCameras.find((room) => room.roomId === interiorRoomId);
    const largest = [...nav.rooms].sort((a, b) => b.areaMm2 - a.areaMm2)[0];
    const preferred = selected ? { x: selected.camera.position[0] * 1000, y: selected.camera.position[2] * 1000 }
      : route?.waypoints[0] ? { x: route.waypoints[0].x, y: route.waypoints[0].y }
        : largest ? { x: (Math.min(...largest.boundary.map((p) => p.x)) + Math.max(...largest.boundary.map((p) => p.x))) / 2,
          y: (Math.min(...largest.boundary.map((p) => p.y)) + Math.max(...largest.boundary.map((p) => p.y))) / 2 } : undefined;
    const start = freeWalkStart(nav, preferred);
    if (!start) { store.getState().setError('No hay espacio transitable para empezar la visita. Revisa muros y muebles.'); return; }
    const room = nav.roomAt(start);
    const centre = room && { x: (Math.min(...room.boundary.map((p) => p.x)) + Math.max(...room.boundary.map((p) => p.x))) / 2,
      y: (Math.min(...room.boundary.map((p) => p.y)) + Math.max(...room.boundary.map((p) => p.y))) / 2 };
    const nextPoint = route?.waypoints.slice(1).find((point) =>
      (!point.levelId || point.levelId === (document.activeLevelId ?? 'ground')) && Math.hypot(point.x - start.x, point.y - start.y) > 300);
    const target = (nextPoint && nav.segmentFree(start, nextPoint) ? nextPoint : null)
      ?? (centre && Math.hypot(centre.x - start.x, centre.y - start.y) > 300 && nav.segmentFree(start, centre) ? centre : null)
      ?? walkOpenFocus(start, nav.segmentFree);
    const focus: [number, number, number] = selected?.camera.focus ?? [target.x / 1000, 1.6, target.y / 1000];
    store.getState().setWalkthroughPlaying(false);
    setAllLevels(Boolean(document.levels?.length && stairLinks.length)); setCutaway(false); setInteriorRoomId(null);
    setWalkPaused(false); setFreeWalk({ start, focus });
    void root.current?.get().gl.domElement.requestPointerLock?.().catch(() => undefined);
  };
  const exitFreeWalk = () => { pauseFreeWalk(); setFreeWalk(null); };
  const inside = interiorRoomId !== null && interiorCameras.some((room) => room.roomId === interiorRoomId);
  // Dentro de una estancia no se recortan muros ni se destapa el techo: se ve lo que vería el usuario.
  const wallCutaway = cutaway && !inside;
  const captureRender = useRef<CaptureScene | null>(null);
  const root = useRef<RootState | null>(null);
  const sceneContainer = useRef<HTMLDivElement | null>(null);
  const planDrag = useRef<PlanDrag | null>(null);
  const suppressPlanClick = useRef(false);
  const [planPreview, setPlanPreview] = useState<PlanMovePreview | null>(null);
  const [planHover, setPlanHover] = useState<{ x: number; y: number } | null>(null);
  const onSceneCreated = useCallback((state: RootState) => {
    state.gl.toneMappingExposure = .9;
    root.current = state;
    setRendererReady(true);
  }, [setRendererReady]);
  const captureSequence = useRef(1000000);
  const captureQueue = useRef<Promise<unknown>>(Promise.resolve());
  const cameraApplied = useRef<((sequence: number) => void) | null>(null);
  const onCameraApplied = useCallback((sequence: number) => cameraApplied.current?.(sequence), []);
  useEffect(() => {
    if (!rendererReady || contextLost) { captureRender.current = null; onCaptureReady?.(null); return; }
    const capture: CaptureScene = (options, fullResolution = false) => {
      if (abortRecording.current || store.getState().walkthroughPlaying || freeWalk) return Promise.reject(new Error('Sal de la visita antes de capturar una imagen.'));
      const inner = captureQueue.current.then(async (): Promise<SceneCapture> => {
      const finishedExterior = !fullResolution && !allLevels && !options?.camera &&
        (options?.view === 'front' || options?.view === 'back' || options?.view === 'left' ||
          options?.view === 'right' || options?.view === 'drone') && hasCompleteInteriorRoof(store.getState().document);
      const initial = root.current?.get();
      if (!initial) throw new Error('La vista 3D no está disponible.');
      const originalPosition = initial.camera.position.clone();
      const originalQuaternion = initial.camera.quaternion.clone();
      const originalLighting = lightingRef.current;
      const originalNear = initial.camera.near, originalFar = initial.camera.far;
      const originalFov = initial.camera instanceof PerspectiveCamera ? initial.camera.fov : null;
      const controls = initial.controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
      const originalEnabled = controls?.enabled;
      const originalTarget = controls?.target.clone();
      const originalSelection = [...store.getState().selection];
      let restoreWalls: (() => void) | null = null;
      let restoreLighting: (() => void) | null = null;
      const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      try {
      store.getState().select([]);
      if (options?.lighting) flushSync(() => setCaptureLighting(options.lighting!));
      // Las zonas limitan dónde se puede diseñar; nunca alteran la cámara elegida.
      if (!options?.camera && (options?.fit || (options?.view && options.view !== 'current'))) {
        const sequence = ++captureSequence.current;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { cameraApplied.current = null; reject(new Error('No se pudo preparar la cámara.')); }, 5000);
          cameraApplied.current = (applied) => {
            if (applied === sequence) { clearTimeout(timeout); cameraApplied.current = null; resolve(); }
          };
          const view = options?.view && options.view !== 'current' ? options.view : null;
          const finishedDirection: Record<string, [number, number, number]> = {
            front: [0, .25, 1], back: [0, .25, -1], left: [-1, .25, 0], right: [1, .25, 0],
          };
          setRequest({ sequence, action: view ?? 'fit',
            focus: view && !allLevels ? scenePresetFocus(store.getState().document, view, activeElevation) : undefined,
            direction: finishedExterior && view ? finishedDirection[view] : undefined });
        });
      }
      const currentDocument = store.getState().document;
      const capturedView = options?.view && options.view !== 'current' ? options.view : activeView;
      // «Vista actual» captura lo que se ve; solo un alzado pedido fuerza el recorte.
      const cut = options?.camera ? false : options?.view && options.view !== 'current'
        ? captureCutaway(options.view, wallCutaway, finishedExterior) : wallCutaway;
      if (options?.camera) {
        const pose = cameraPoseSchema.parse(options.camera);
        if (allLevels) throw new Error('Activa Solo planta activa antes de capturar un punto del recorrido.');
        flushSync(() => setCapturingPose(true));
        if (pose.levelId !== (currentDocument.activeLevelId ?? null)) throw new Error('La vista pertenece a otra planta.');
        if (!(initial.camera instanceof PerspectiveCamera)) throw new Error('Cámara no compatible');
        if (controls) controls.enabled = false;
        initial.camera.position.fromArray(pose.position); initial.camera.lookAt(...pose.focus);
        initial.camera.fov = pose.fovDeg; initial.camera.updateProjectionMatrix();
      }
      const visibleLevels = allLevels ? buildingDocuments(currentDocument) : [{ document: currentDocument, elevationMm: 0 }];
      const ceilingHeights = visibleLevels.flatMap((level) => ceilingSurfaces(level.document)
        .map((surface) => (surface.heightMm + level.elevationMm) / 1000));
      const capturedCeilingView = options?.camera ? 'solid'
        : fullResolution && (!options?.view || options.view === 'current')
          ? presentation === 'plan' ? 'hidden' : inside ? 'solid' : ceilingView
          : captureCeilingView(
        capturedView,
        { cutaway: cut, forDesign: !fullResolution, cameraHeightM: initial.camera.position.y,
          highestCeilingM: ceilingHeights.length ? Math.max(...ceilingHeights) : null, finishedExterior },
      );
      flushSync(() => setCaptureCeilings(capturedCeilingView));
      // El bucle es bajo demanda: sin esto una captura que solo mueve la cámara
      // no dibujaría ningún fotograma y el recorte de muros quedaría el de antes.
      initial.invalidate();
      await frames();
      const state = root.current?.get();
      if (!state || state.gl.getContext().isContextLost()) throw new Error('La vista 3D no está disponible.');
      // Recorte aplicado aquí mismo y no vía estado: debe estar en ESTA foto.
      if (cut) restoreWalls = hideWallsFacingCamera(state.scene, state.camera);
      // Para diseñar con IA la iluminación siempre cuenta; el PNG nativo captura lo que se ve.
      if (!fullResolution) restoreLighting = revealHiddenLighting(state.scene);
      state.gl.render(state.scene, state.camera);
      const camera = state.camera;
      if (!('fov' in camera) || typeof camera.fov !== 'number') throw new Error('Cámara no compatible.');
      const dataUrl = captureForPersistence(state.gl.domElement);
      const downloadDataUrl = fullResolution ? state.gl.domElement.toDataURL('image/png') : undefined;
      // Misma cámara y mismo encuadre: la máscara casa píxel a píxel con la captura.
      const maskDataUrl = options?.maskRegions?.length
        ? renderZoneMask(state.gl, state.scene, camera, options.maskRegions, captureForPersistence) : undefined;
      return { dataUrl, ...(maskDataUrl ? { maskDataUrl } : {}),
        ...(downloadDataUrl ? { downloadDataUrl } : {}), view: {
        preset: options?.camera ? 'custom' : options?.view && options.view !== 'current' ? options.view : activeView ?? 'custom', focus: camera.position.clone().add(camera.getWorldDirection(new Vector3())).toArray(), levelId: currentDocument.activeLevelId ?? null, levelElevationM: allLevels ? (buildingDocuments(currentDocument).find((level) => level.id === currentDocument.activeLevelId)?.elevationMm ?? 0) / 1000 : 0, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        fov: camera.fov, aspect: state.size.width / state.size.height, allLevels, cutaway: cut,
        ceilingView: capturedCeilingView,
        lighting: options?.lighting ?? originalLighting,
        cutawayWallIds: cut ? scene.exteriorWalls.filter((wall) =>
          (camera.position.x - wall.x) * wall.normalX + (camera.position.z - wall.z) * wall.normalZ > .01,
        ).map((wall) => wall.sourceEntityId) : [],
      } };
      } finally {
        restoreWalls?.();
        restoreLighting?.();
        const renderer = root.current?.get().gl;
        if (renderer?.clippingPlanes.length) renderer.clippingPlanes = [];
        initial.camera.position.copy(originalPosition);
        initial.camera.quaternion.copy(originalQuaternion);
        if (initial.camera instanceof PerspectiveCamera && originalFov !== null) initial.camera.fov = originalFov;
        if (controls && originalEnabled !== undefined) controls.enabled = originalEnabled;
        initial.camera.near = originalNear;
        initial.camera.far = originalFar;
        initial.camera.updateProjectionMatrix();
        if (controls && originalTarget) { controls.target.copy(originalTarget); controls.update(); }
        flushSync(() => { setCaptureLighting(null); setCaptureCeilings(null); setCapturingPose(false); });
        store.getState().select(originalSelection);
        initial.invalidate();
        await frames();
      }
      });
      const job = withTimeout(inner, CAPTURE_TIMEOUT_MS, 'La captura del 3D tardó demasiado. Comprueba que la vista 3D se ve y vuelve a intentarlo.');
      // La cola sigue a la TAREA real, no a la promesa acotada: tras un plazo
      // agotado, la captura anterior aún mueve cámara, cortes y visibilidad, y su
      // `finally` pisaría a la siguiente. Las esperas internas tienen su propio plazo.
      captureQueue.current = inner.catch(() => undefined);
      return job;
    };
    captureRender.current = capture;
    onCaptureReady?.(capture);
    return () => { captureRender.current = null; onCaptureReady?.(null); };
  }, [onCaptureReady, rendererReady, contextLost, store, activeView, allLevels, wallCutaway, scene, lighting, freeWalk, activeElevation, ceilingView, inside, presentation]);
  const otherLevels = useMemo(() => renderAllLevels ? buildingDocuments(document).filter((l) => l.id !== document.activeLevelId)
    .map((l) => ({ ...l, scene: editorDocumentToScene(l.document,
      stairLinks.filter((link) => link.upperLevelId === l.id).map((link) => link.outline)) })) : [], [document, renderAllLevels, stairLinks]);
  // La estancia que manda en el reparto de luces reales: donde está la cámara y,
  // si no, la del elemento seleccionado. Así se encienden primero las que se ven.
  const activeLuminaires = useMemo(() => resolvedLuminaires(document), [document]);
  const activeStrips = useMemo(() => resolvedStrips(document), [document]);
  const priorityRoomId = inside ? interiorRoomId
    : activeLuminaires.find((light) => selection.includes(light.luminaire.id))?.roomId
      ?? activeStrips.find((strip) => selection.includes(strip.strip.id))?.roomId
      ?? ceilingSurfaces(document).find((surface) => selection.includes(surface.ceiling.id))?.room.id
      ?? null;
  const ceilingIssues = useMemo(() => computeCeilingIssues(document), [document]);
  // Avisos con el elemento al que apuntan: el nombre es un enlace que lo selecciona para revisarlo.
  const notices: CeilingIssue[] = [...scene.warnings.map((message) => ({ label: 'Plano', message })), ...ceilingIssues];
  const noticeKey = notices.map((n) => `${n.id ?? ''}:${n.message}`).join('|');
  // La planta activa usa el presupuesto entero; el resto, lo que queda (luces y tiras).
  const budgetLevels: BudgetLevel[] = useMemo(() => [
    { luminaires: activeLuminaires, strips: activeStrips, priorityRoomId },
    ...otherLevels.map((level) => ({ luminaires: resolvedLuminaires(level.document), strips: resolvedStrips(level.document) })),
  ], [activeLuminaires, activeStrips, priorityRoomId, otherLevels]);
  const lightBudgets = useMemo(() => levelLightBudgets(budgetLevels).slice(1), [budgetLevels]);
  const coverage = useMemo(() => lightingCoverage(budgetLevels), [budgetLevels]);
  const planElevationM = activeElevation / 1000;
  const pendingPlanItem = presentation === 'plan' && pendingSpatial && planHover
    ? positionedPending(pendingSpatial, planHover, store) : null;
  const onPlanPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (presentation !== 'plan') return;
    const point = scenePlanPoint(root, event.clientX, event.clientY, planElevationM);
    if (!point) return;
    if (pendingSpatial) setPlanHover(point);
    const drag = planDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const item = planDragPosition(drag, point, store);
    setPlanPreview({ id: drag.id, dxMm: item.x - drag.item.x, dyMm: item.y - drag.item.y,
      dzMm: (item.elevationMm ?? 0) - (drag.item.elevationMm ?? 0) });
  };
  const onPlanPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = planDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = scenePlanPoint(root, event.clientX, event.clientY, planElevationM);
    suppressPlanClick.current = Boolean(point && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) >= 30);
    planDrag.current = null;
    setPlanPreview(null);
    finishPlanDrag(event, drag, store, root, planElevationM);
  };
  const onPlanPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = planDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = root.current?.get().gl.domElement;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    planDrag.current = null;
    setPlanPreview(null);
  };
  const onPlanClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (presentation !== 'plan' || !(event.target instanceof HTMLCanvasElement)) return;
    const state = store.getState();
    if (state.readOnly || state.tool !== 'place-object' || !state.pendingSpatial) return;
    const point = scenePlanPoint(root, event.clientX, event.clientY, planElevationM);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    state.placePendingSpatial(positionedPending(state.pendingSpatial, point, store));
  };
  const editPlanItem = (edit: (item: NonNullable<typeof document.furniture[number]>) => ReturnType<typeof updateFurniture>) => {
    const id = planMenu?.id, item = document.furniture.find((entry) => entry.id === id);
    if (!item) return;
    try { store.getState().apply(edit(item)); setPlanMenu(null); }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo editar el elemento.'); }
  };
  const highestRenderedElevation = Math.max(activeElevation, ...otherLevels.map((level) => level.elevationMm));
  // En plantas apiladas, la cara inferior del forjado y el pavimento superior
  // pueden coincidir exactamente: un pequeño espesor visual evita parpadeos.
  const ceilingOffset = (elevationMm: number) => elevationMm < highestRenderedElevation ? -.02 : 0;
  const lost = useCallback(() => setContextLost(true), [setContextLost]);
  const manualCameraChange = useCallback(() => setActiveView(null), [setActiveView]);
  const sceneVersion = useMemo(() => ({ scene, otherLevels, activeElevation }), [scene, otherLevels, activeElevation]);
  const select = (id: string) => {
    if (!abortRecording.current && !freeWalk && !(presentation === 'plan' && store.getState().pendingSpatial)) {
      store.getState().select([id]);
      if (id.startsWith('room:')) store.getState().setDetailPanel('paint');
    }
  };
  const camera = (action: SceneViewAction) => {
    if (abortRecording.current || walking || freeWalk) return;
    // Cualquier vista preset o encuadre saca al usuario de la estancia.
    if (action !== 'in' && action !== 'out') setInteriorRoomId(null);
    if (action === 'top' || action === 'isometric' || action === 'front' || action === 'back' || action === 'left' || action === 'right' || action === 'drone') setActiveView(action);
    setRequest((r) => ({ sequence: r.sequence + 1, action: action as CameraRequest['action'],
      focus: !renderAllLevels && (action === 'front' || action === 'back' || action === 'left' || action === 'right' || action === 'drone')
        ? scenePresetFocus(document, action, activeElevation) : undefined }));
  };
  useEffect(() => store.subscribe((next, previous) => {
    if (presentation !== 'plan' || next.viewRequest === previous.viewRequest || !next.viewRequest) return;
    const action = next.viewRequest.kind === 'fit' ? 'top' : next.viewRequest.kind === 'zoom-in' ? 'in' : 'out';
    setRequest((current) => ({ sequence: current.sequence + 1, action }));
  }), [presentation, store]);
  const showMaquette = () => {
    // Cámara y visibilidad de la escena viva; muebles, suelos y muros siguen
    // siendo los mismos objetos que verá el recorrido y capturará el render.
    store.getState().setCeilingView('hidden');
    setAllLevels(false);
    setCutaway(false);
    camera('top');
  };
  const enterRoom = (roomId: string | null) => {
    if (abortRecording.current || walking || freeWalk) return;
    if (!roomId) {
      setInteriorRoomId(null);
      setActiveView(null);
      setRequest((r) => ({ sequence: r.sequence + 1, action: 'fit' }));
      return;
    }
    const target = interiorCameras.find((room) => room.roomId === roomId);
    if (!target) return;
    setInteriorRoomId(roomId);
    setActiveView(null);
    setRequest((r) => ({ sequence: r.sequence + 1, action: 'interior',
      pose: { position: target.camera.position, focus: target.camera.focus, fovDeg: target.camera.fovDeg } }));
  };
  const exportNativeRender = async () => {
    const capture = captureRender.current;
    if (!capture || exporting || abortRecording.current || walking || freeWalk) return;
    setExporting(true);
    let downloaded = false;
    try {
      // Comparte cola, limpieza de selección y restauración con las capturas para IA.
      const captured = await capture({ view: 'current' }, true);
      const { dataUrl, downloadDataUrl } = captured;
      const download = window.document.createElement('a');
      download.href = downloadDataUrl ?? dataUrl;
      download.download = `habiteka-render-nativo-${new Date().toISOString().slice(0, 10)}.png`;
      download.click();
      downloaded = true;
      await onSaveNativeRender?.({ dataUrl, view: captured.view });
      setExportMessage(onSaveNativeRender ? 'Render guardado en Diseños.' : 'PNG descargado.');
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
      setExportMessage(`${downloaded ? 'El PNG se descargó, pero no se pudo guardar en Diseños.' : 'No se pudo capturar el render.'}${detail}`);
    } finally {
      setExporting(false);
    }
  };
  const exportWalk = async (mode: NativeVideoMode) => {
    if (!allowVideoExport || !route || !root.current || recording || exporting || freeWalk) return;
    const issue = mode === 'showcase' ? routeExport?.showcaseIssue : routeExport?.walkthroughIssue;
    if (issue) { setExportMessage(issue); return; }
    const frozen = store.getState().document, selectionBefore = [...store.getState().selection];
    const controller = new AbortController(); abortRecording.current = controller;
    store.getState().setWalkthroughPlaying(false); store.getState().select([]);
    const unsubscribe = store.subscribe((next) => { if (next.document !== frozen) controller.abort(); });
    flushSync(() => { setRecording(true); setRecordProgress(0); setExportMessage(null); });
    try {
      const job = captureQueue.current.then(async () => {
        controller.signal.throwIfAborted();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const elevationMm = multiLevelRoute ? buildingDocuments(frozen).find((level) => level.id === frozen.activeLevelId)?.elevationMm ?? 0 : activeElevation;
        return recordWalkthrough(root.current!.get(), frozen, route, elevationMm, controller.signal, setRecordProgress, mode);
      });
      captureQueue.current = job.catch(() => undefined);
      const blob = await job;
      const url = URL.createObjectURL(blob), link = window.document.createElement('a');
      link.href = url; link.download = mode === 'showcase' ? 'habiteka-obra-y-visita.mp4' : 'habiteka-recorrido.mp4'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportMessage('MP4 descargado.');
      if (onSaveNativeVideo) { await onSaveNativeVideo(blob, route.id, mode); setExportMessage('MP4 descargado y guardado en Diseños.'); }
    } catch (error) { setExportMessage(controller.signal.aborted ? 'Exportación cancelada.' : error instanceof Error ? error.message : 'No se pudo exportar'); }
    finally { unsubscribe(); setRecording(false); store.getState().select(selectionBefore); abortRecording.current = null; }
  };
  if (contextLost) return <div role="alert" style={{ padding: 24 }}>
    <p>Se interrumpió la vista 3D. El documento permanece disponible en 2D.</p>
    <button type="button" onClick={() => setContextLost(false)}>Reintentar vista 3D</button>
  </div>;
  return <div ref={sceneContainer} style={{ height: '100%', minHeight: 320, position: 'relative', background: '#eeede8' }} aria-label={presentation === 'plan' ? 'Plano visual cenital editable' : 'Vista 3D del plano'}
    onContextMenuCapture={presentation === 'plan' ? (event) => event.preventDefault() : undefined}
    onPointerDownCapture={(event) => { suppressPlanClick.current = false; if (!(event.target as HTMLElement).closest('[data-plan-menu]')) setPlanMenu(null); }}
    onClickCapture={(event) => {
      if (suppressPlanClick.current) { suppressPlanClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
      onPlanClick(event);
    }}
    onPointerMove={onPlanPointerMove} onPointerUp={onPlanPointerUp} onPointerCancel={onPlanPointerCancel}>
    {presentation === 'spatial' && route && !freeWalk && <div style={{ position: 'absolute', zIndex: 5, top: 16, left: 24, maxWidth: 'calc(100% - 48px)', padding: 12, borderRadius: 8, background: '#fff', color: '#22362e', boxShadow: '0 8px 24px #17352724', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }} aria-label="Reproducir recorrido">
      <strong>{route.name}</strong>
      {routeExport && routeExport.durationMs > 0 && <span>{Math.ceil(routeExport.durationMs / 1000)} s de recorrido</span>}
      <button type="button" disabled={recording} onClick={() => store.getState().hideWalkthrough()}>Ocultar recorrido</button>
      <button type="button" disabled={recording} onClick={() => {
        try {
          const result = buildWalkthrough(document, route);
          if (result.invalidSegments.length) throw new Error('La ruta cruza obstáculos. Ajusta los puntos del recorrido.');
          store.getState().setWalkthroughPlaying(!walking);
        } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Ruta inválida'); }
      }}>{walking ? 'Detener' : 'Reproducir'}</button>
      {allowVideoExport ? <>
        <button type="button" className="rounded bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={recording || walking || exporting || Boolean(routeExport?.walkthroughIssue) || (store.getState().readOnly && !onSaveNativeVideo)} onClick={() => void exportWalk('walkthrough')}>Exportar y guardar recorrido · MP4</button>
        <button type="button" className="rounded border border-emerald-800 px-3 py-2 font-semibold text-emerald-900 disabled:opacity-50" disabled={recording || walking || exporting || Boolean(routeExport?.showcaseIssue) || (store.getState().readOnly && !onSaveNativeVideo)} onClick={() => void exportWalk('showcase')}>Guardar vídeo muestra · obra + visita</button>
      </> : onOpenApprovedRoute && <button type="button" className="rounded bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={recording || walking || exporting || Boolean(routeExport?.walkthroughIssue)}
        onClick={() => void onOpenApprovedRoute(route.id)}>Abrir visita aprobada para exportar vídeo</button>}
      {routeExport?.walkthroughIssue && <span role="alert">{routeExport.walkthroughIssue}</span>}
      {!routeExport?.walkthroughIssue && routeExport?.showcaseIssue && <span role="status">Vídeo muestra: {routeExport.showcaseIssue}</span>}
      {recording && <><span role="status">{recordProgress >= 1 ? 'Guardando…' : `${Math.round(recordProgress * 100)} %`}</span><button type="button" disabled={recordProgress >= 1} onClick={() => abortRecording.current?.abort()}>Cancelar</button></>}
    </div>}
    <Canvas frameloop="demand" shadows="percentage" dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true }}
      onCreated={onSceneCreated} camera={{ position: [8, 9, -10], fov: presentation === 'plan' ? 25 : 45, near: .01, far: 500 }}
      fallback={rendererReady ? null : unavailable} onPointerMissed={() => {
        if (presentation !== 'plan' || store.getState().tool !== 'place-object') store.getState().select([]);
      }}>
      <SceneLighting key={lighting} preset={lighting} hasLuminaires={[document, ...otherLevels.map((level) => level.document)]
        .some((levelDocument) => resolvedLuminaires(levelDocument).length > 0)} />
      <SceneEnvironment preset={lighting} />
      {presentation === 'spatial' && <SceneGround scene={scene} elevationMm={activeElevation} />}
      <Bounds>
        <group position={[0, activeElevation / 1000, 0]} onContextMenu={presentation === 'plan' ? (event) => {
          const id = sceneEntityId(event.object), item = document.furniture.find((entry) => entry.id === id);
          if (!item || store.getState().readOnly || store.getState().pendingSpatial) return;
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          store.getState().select([item.id]);
          const rect = sceneContainer.current?.getBoundingClientRect();
          if (rect) setPlanMenu({ id: item.id,
            x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 254)),
            y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 358)) });
        } : undefined} onPointerDown={presentation === 'plan' ? (event) => {
          planDrag.current = beginPlanDrag(event, store, root, planElevationM);
        } : undefined}>
          <OutdoorLighting document={document} />
          <group position={[0, ceilingOffset(activeElevation), 0]} visible={showLighting} userData={{ lightingLayer: true, videoStage: 2 }}>
            <CeilingLightingMeshes document={document} view={walking || recording || inside || freeWalk ? 'solid' : captureCeilings ?? (presentation === 'plan' ? 'hidden' : ceilingView)}
              ceilingVoids={stairLinks.filter((link) => link.lowerLevelId === document.activeLevelId).map((link) => link.outline)}
              selection={selection} onSelect={select} priorityRoomId={priorityRoomId} />
          </group>
          {scene.polygons.map((polygon) => <group key={polygon.id} userData={{ videoStage: polygon.role === 'floor' ? 0 : 1 }}><CutawayWall cuttable={polygon.role !== 'floor'} enabled={!walking && !freeWalk && !recording && !capturingPose && wallCutaway && polygon.role !== 'floor'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === polygon.sourceEntityId)} selected={selection.includes(polygon.sourceEntityId)}>
            <PolygonMesh polygon={polygon} selected={selection.includes(polygon.sourceEntityId)} onSelect={select} />
          </CutawayWall></group>)}
          {scene.boxes.filter((box) => !modeled.has(box.sourceEntityId)).map((box) => {
            // Marco, hoja y cristal de un hueco se recortan con su muro: si no, quedan flotando.
            const hostWallId = openingHosts.get(box.sourceEntityId), cuttable = box.role === 'wall' || hostWallId !== undefined;
            return <group key={box.id} position={planPreview?.id === box.sourceEntityId ? [planPreview.dxMm / 1000, planPreview.dzMm / 1000, planPreview.dyMm / 1000] : [0, 0, 0]}
              userData={{ videoStage: box.role === 'furniture' ? 3 : cuttable && box.role !== 'wall' ? 2 : 1 }}><CutawayWall cuttable={cuttable} enabled={!walking && !freeWalk && !recording && !capturingPose && wallCutaway && cuttable}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === (hostWallId ?? box.sourceEntityId))} selected={selection.includes(box.sourceEntityId)}>
            <BoxMesh box={box} selected={selection.includes(box.sourceEntityId)} onSelect={select} />
          </CutawayWall></group>;
          })}
          {scene.ramps.map((ramp) => <group key={ramp.id} userData={{ videoStage: 1 }}><RampMesh ramp={ramp} selected={selection.includes(ramp.sourceEntityId)} onSelect={select} /></group>)}
          {document.furniture.filter((item) => modeled.has(item.id)).map((item) => <group key={item.id}
            position={planPreview?.id === item.id ? [planPreview.dxMm / 1000, planPreview.dzMm / 1000, planPreview.dyMm / 1000] : [0, 0, 0]}
            userData={{ videoStage: 3 }}><FurnitureModel item={item}
            boxes={scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={selection.includes(item.id)} onSelect={select} /></group>)}
          {pendingPlanItem && (() => {
            const center = objectCenter(pendingPlanItem);
            return <mesh position={[center.x / 1000, (pendingPlanItem.elevationMm ?? 0) / 1000 + .035, center.y / 1000]}
              rotation={[0, -pendingPlanItem.rotation * Math.PI / 180, 0]} raycast={() => undefined}>
              <boxGeometry args={[pendingPlanItem.widthMm / 1000, .025, pendingPlanItem.depthMm / 1000]} />
              <meshBasicMaterial color="#087f75" transparent opacity={.34} depthWrite={false} />
              <Edges color="#087f75" />
            </mesh>;
          })()}
        </group>
        {otherLevels.filter(() => Boolean(document.levels)).map((level, index) => <group key={level.id} position={[0, level.elevationMm / 1000, 0]}>
          <group position={[0, ceilingOffset(level.elevationMm), 0]} visible={showLighting} userData={{ lightingLayer: true, videoStage: 2 }}>
            <CeilingLightingMeshes document={level.document} view={walking || recording || freeWalk ? 'solid' : captureCeilings ?? ceilingView}
              ceilingVoids={stairLinks.filter((link) => link.lowerLevelId === level.id).map((link) => link.outline)}
              lightBudget={lightBudgets[index]} shadowBudget={0} />
          </group>
          {level.scene.polygons.map((polygon) => <group key={polygon.id} userData={{ videoStage: polygon.role === 'floor' ? 0 : 1 }}>
            <PolygonMesh polygon={polygon} selected={false} onSelect={() => {}} /></group>)}
          {level.scene.boxes.filter((box) => !level.document.furniture.some((item) => item.id === box.sourceEntityId && furnitureAsset(item)))
            .map((box) => <group key={box.id} userData={{ videoStage: box.role === 'furniture' ? 3 : box.role === 'wall' ? 1 : 2 }}>
              <BoxMesh box={box} selected={false} onSelect={() => {}} /></group>)}
          {level.scene.ramps.map((ramp) => <group key={ramp.id} userData={{ videoStage: 1 }}>
            <RampMesh ramp={ramp} selected={false} onSelect={() => {}} /></group>)}
          {level.document.furniture.filter((item) => furnitureAsset(item)).map((item) => <group key={item.id} userData={{ videoStage: 3 }}>
            <FurnitureModel item={item} boxes={level.scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={false} onSelect={() => {}} /></group>)}
        </group>)}
        <WalkCamera store={store} elevationMm={activeElevation} />
        {freeWalk && <FreeWalkCamera document={document} start={freeWalk.start} focus={freeWalk.focus}
          paused={walkPaused} viewMode={walkViewMode} controller={freeWalkController} onPause={pauseFreeWalk} onToggleView={toggleWalkView} />}
        <SceneCamera request={request} sceneVersion={sceneVersion} interior={inside} enabled={!walking && !freeWalk && !recording} plan={presentation === 'plan'}
          onManualChange={manualCameraChange} onContextLost={lost} onApplied={onCameraApplied} />
      </Bounds>
      {presentation === 'plan' && document.labels.map((label) => <Html key={label.id}
        position={[label.x / 1000, planElevationM + .04, label.y / 1000]} center
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', color: '#263630', fontSize: 15,
          fontWeight: 700, letterSpacing: '.01em', textShadow: '0 1px 3px #fff, 0 0 6px #fff' }}>
        {label.text}
      </Html>)}
      {[...new Set(document.comments?.map((c) => c.targetEntityId) ?? [])].map((id) => {
        const comments = document.comments!.filter((c) => c.targetEntityId === id), p = commentAnchor(document, comments[0]!);
        return p && <Html key={id} position={[p.x / 1000, (p.elevationMm + activeElevation) / 1000 + .15, p.y / 1000]} center>
          <button type="button" aria-label={`Ver ${comments.length} comentarios del elemento`} style={{ background: '#087f75', color: 'white', borderRadius: 20, padding: '4px 10px' }}
            onClick={(e) => { e.stopPropagation(); select(id); store.getState().setDetailPanel('comments'); }}>{comments.length}</button>
        </Html>;
      })}
    </Canvas>
    {presentation === 'plan' && !store.getState().readOnly && selection.length === 1 && document.furniture.some((item) => item.id === selection[0]) &&
      <button type="button" onClick={() => setPlanMenu({ id: selection[0]!, x: 20, y: 60 })}
        style={{ position: 'absolute', top: 12, left: 16, zIndex: 4, borderRadius: 8,
          background: '#fffdfa', color: '#294640', boxShadow: '0 4px 16px rgba(31,57,52,.12)' }}>
        Girar / colocar encima
      </button>}
    {presentation === 'plan' && planMenu && (() => {
      const item = document.furniture.find((entry) => entry.id === planMenu.id);
      return item && <ScenePlanContextMenu document={document} item={item} x={planMenu.x} y={planMenu.y}
        onRotate={(degrees) => editPlanItem((current) => updateFurniture(document, current.id, { rotation: (current.rotation + degrees + 360) % 360 }))}
        onHost={(hostId) => editPlanItem((current) => {
          const host = planObjects(document).find((entry) => entry.id === hostId);
          if (!host) throw new Error('La superficie ya no está disponible.');
          const placed = placeOnHost(current, host);
          return updateFurniture(document, current.id, { x: placed.x, y: placed.y, elevationMm: placed.elevationMm, hostId: placed.hostId });
        })}
        onClose={() => setPlanMenu(null)} />;
    })()}
    {presentation === 'plan' && <div style={{ position: 'absolute', left: 20, bottom: 20, zIndex: 2, padding: '9px 13px', borderRadius: 8, background: 'rgba(255,255,255,.94)', color: '#294640', boxShadow: '0 4px 16px rgba(31,57,52,.12)', fontSize: 13, pointerEvents: 'none' }}>
      {pendingSpatial ? 'Haz clic para colocar · Esc para cancelar' : store.getState().readOnly
        ? readOnlyLabel
        : 'Arrastra muebles para moverlos · clic derecho para girar o colocar encima · Amueblar para añadir'}
    </div>}
    {presentation === 'spatial' && !recording && !walking && !freeWalk && <SceneViewControls activeView={activeView} maquetteActive={activeView === 'top' && ceilingView === 'hidden' && !allLevels && !cutaway && !inside} hasLevels={Boolean(document.levels)} cutaway={cutaway} allLevels={allLevels} exporting={exporting}
      ceilingView={ceilingView} interiorRooms={interiorCameras} interiorRoomId={inside ? interiorRoomId : null}
      interiorDisabledReason={allLevels ? 'Activa «Una planta» para entrar en una estancia' : null}
      onCamera={camera} onViewChange={camera} onMaquette={showMaquette} onCutawayChange={() => setCutaway((v) => !v)} onAllLevelsChange={() => { setInteriorRoomId(null); setAllLevels((v) => !v); }}
      onCeilingViewChange={(view) => store.getState().setCeilingView(view)} onEnterRoom={enterRoom}
      canFreeWalk={interiorCameras.length > 0} onFreeWalk={enterFreeWalk}
      onExport={() => void exportNativeRender()} />}
    {freeWalk && <FreeWalkOverlay paused={walkPaused} controller={freeWalkController} document={document} start={freeWalk.start}
      viewMode={walkViewMode} onToggleView={toggleWalkView}
      onPause={() => walkPaused ? setWalkPaused(false) : pauseFreeWalk()}
      onExit={exitFreeWalk} onMouse={() => { setWalkPaused(false); void root.current?.get().gl.domElement.requestPointerLock?.().catch(() => undefined); }} />}
    {!lightingLocked && <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Iluminación de la escena">
      {(Object.keys(SCENE_LIGHTING_LABELS) as SceneLightingPreset[]).map((preset) => <button key={preset} type="button"
        disabled={recording} aria-pressed={lighting === preset} onClick={() => onLightingChange?.(preset)}>{SCENE_LIGHTING_LABELS[preset]}</button>)}
    </div>}
    {coverage.enabled > coverage.emitting && <div role="status" style={{ position: 'absolute', bottom: 56, right: 16, maxWidth: 300, padding: '6px 9px', borderRadius: 'var(--radius)', background: 'rgba(250, 252, 250, .94)', border: '1px solid var(--line)', color: '#294640', fontSize: 11, lineHeight: 1.35 }}>
      {coverage.emitting} de {coverage.enabled} luces iluminan en 3D (límite del navegador); el diseño con IA las usa todas.
      {' '}{inside ? 'Se priorizan las de la estancia en la que estás.' : 'Entra en una estancia para priorizar las suyas.'}
    </div>}
    {exportMessage && <div role="status" style={{ position: 'absolute', bottom: 56, left: 16 }}>{exportMessage}</div>}
    {showNotices && notices.length > 0 && dismissedNotice !== noticeKey && <div role="status" style={{ position: 'absolute', top: 12, left: 16, maxWidth: 420, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-panel)', fontSize: 12 }}>
      <TriangleAlert size={16} aria-hidden="true" style={{ flex: 'none', color: '#b8860b' }} />
      <div><strong>Revisar en el plano</strong><ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{notices.map((notice) => <li key={`${notice.id ?? ''}:${notice.message}`}>
        {notice.id ? <button type="button" onClick={() => store.getState().select([notice.id!])} style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>{notice.label}</button> : <strong>{notice.label}</strong>}: {notice.message}
      </li>)}</ul></div>
      <button type="button" aria-label="Cerrar aviso" onClick={() => setDismissedNotice(noticeKey)} style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer' }}><X size={14} aria-hidden="true" /></button>
    </div>}
  </div>;
}
export function EditorSceneView({
  store,
  presentation,
  allowVideoExport,
  onOpenApprovedRoute,
  lightingPreset,
  onLightingChange,
  lightingLocked,
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
  showLighting,
  showNotices,
  readOnlyLabel,
}: {
  store: EditorStore;
  presentation?: 'plan' | 'spatial';
  allowVideoExport?: boolean;
  onOpenApprovedRoute?: (routeId: string) => Promise<void>;
  lightingPreset?: SceneLightingPreset;
  onLightingChange?: (preset: SceneLightingPreset) => void;
  lightingLocked?: boolean;
  onSaveNativeVideo?: (blob: Blob, routeId: string, mode: NativeVideoMode) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
  showLighting?: boolean;
  showNotices?: boolean;
  readOnlyLabel?: string;
}) {
  return <SceneErrorBoundary><SceneView store={store} presentation={presentation} allowVideoExport={allowVideoExport}
    onOpenApprovedRoute={onOpenApprovedRoute}
    lightingPreset={lightingPreset} onLightingChange={onLightingChange} lightingLocked={lightingLocked}
    onSaveNativeVideo={onSaveNativeVideo} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady}
    showLighting={showLighting} showNotices={showNotices} readOnlyLabel={readOnlyLabel} /></SceneErrorBoundary>;
}
export default EditorSceneView;
