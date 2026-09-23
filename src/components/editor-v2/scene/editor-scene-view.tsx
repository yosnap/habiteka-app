'use client';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Canvas, type RootState } from '@react-three/fiber';
import { flushSync } from 'react-dom';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { Bounds, Html } from '@react-three/drei';
import { Vector3, PerspectiveCamera, Plane } from 'three';
import { cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { BoxMesh, PolygonMesh, RampMesh } from './scene-meshes';
import { SceneCamera, type CameraRequest } from './scene-camera';
import { CutawayWall, hideWallsFacingCamera, revealHiddenLighting } from './cutaway-wall';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { FurnitureModel } from './furniture-model';
import { OutdoorLighting } from './outdoor-lighting';
import { WalkCamera } from './walk-camera';
import { recordWalkthrough } from './offline-recorder';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { SceneLighting, SCENE_LIGHTING_LABELS, type SceneLightingPreset } from './scene-lighting';
import { CeilingLightingMeshes } from './ceiling-lighting-meshes';
import { captureCeilingView, captureCutaway, MAX_LUMINAIRE_LIGHTS, type CeilingView } from './ceiling-scene-utils';
import { resolvedLuminaires, ceilingSurfaces, ceilingIssues as computeCeilingIssues, type CeilingIssue } from '@/lib/editor-document/ceiling-geometry';
import { SceneViewControls, type SceneViewAction, type SceneViewPreset } from './scene-view-controls';
import { withTimeout } from '@/lib/async-wait';
import { renderZoneMask } from './zone-mask';
import { zoneFraming } from './zone-framing';
import { wallConstruction } from '@/lib/editor-document/construction-properties';

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
/** Altura de la planta activa para encuadrar una zona: el muro más alto (m). */
function levelHeightM(document: EditorDocument): number {
  const heights = document.walls.map((wall) => (wall.baseElevationMm ?? 0) + wallConstruction(wall).heightMm);
  return (heights.length ? Math.max(...heights) : 2700) / 1000;
}

/** Base de la planta activa en la escena (la vista de todas las plantas la desplaza). */
function levelElevationM(document: EditorDocument): number {
  return (buildingDocuments(document).find((level) => level.id === document.activeLevelId)?.elevationMm ?? 0) / 1000;
}

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
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
  showLighting = true,
}: {
  store: EditorStore;
  onSaveNativeVideo?: (blob: Blob, routeId: string) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
  showLighting?: boolean;
}) {
  const document = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const ceilingView = useStore(store, (s) => s.ceilingView);
  const [captureCeilings, setCaptureCeilings] = useState<CeilingView | null>(null);
  const scene = useMemo(() => editorDocumentToScene(document), [document]);
  const openingHosts = useMemo(() => new Map(document.openings.map((opening) => [opening.id, opening.wallId])), [document]);
  const modeled = useMemo(() => new Set(document.furniture.filter((item) => furnitureAsset(item)).map((item) => item.id)), [document]);
  const [request, setRequest] = useState<CameraRequest>({ sequence: 0, action: 'fit' });
  const [activeView, setActiveView] = useState<SceneViewPreset | null>(null);
  const routeId = useStore(store, (s) => s.walkthroughId);
  const walking = useStore(store, (s) => s.walkthroughPlaying);
  const route = document.walkthroughs?.find((path) => path.id === routeId);
  const [capturingPose, setCapturingPose] = useState(false);
  const [recording, setRecording] = useState(false), [recordProgress, setRecordProgress] = useState(0);
  const abortRecording = useRef<AbortController | null>(null);
  useEffect(() => () => { abortRecording.current?.abort(); store.getState().setWalkthroughPlaying(false); }, [store]);
  const [contextLost, setContextLost] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  // Por defecto se ve el modelo completo; ocultar los muros hacia la cámara es opcional.
  const [cutaway, setCutaway] = useState(false);
  const [allLevels, setAllLevels] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  // Avisos de construcción (suelo sin cerrar, techos, luces) como notificación con cierre; reaparece si cambian.
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const [lighting, setLighting] = useState<SceneLightingPreset>('daylight');
  const lightingRef = useRef(lighting);
  useEffect(() => { lightingRef.current = lighting; }, [lighting]);
  const captureRender = useRef<CaptureScene | null>(null);
  const root = useRef<RootState | null>(null);
  const captureSequence = useRef(1000000);
  const captureQueue = useRef<Promise<unknown>>(Promise.resolve());
  const cameraApplied = useRef<((sequence: number) => void) | null>(null);
  const onCameraApplied = useCallback((sequence: number) => cameraApplied.current?.(sequence), []);
  useEffect(() => {
    if (!rendererReady || contextLost) { captureRender.current = null; onCaptureReady?.(null); return; }
    const capture: CaptureScene = (options, fullResolution = false) => {
      if (abortRecording.current || store.getState().walkthroughPlaying) return Promise.reject(new Error('Detén el recorrido antes de capturar una imagen.'));
      const inner = captureQueue.current.then(async (): Promise<SceneCapture> => {
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
      if (options?.lighting) flushSync(() => setLighting(options.lighting!));
      // Con zonas, un ángulo pedido enseña solo la zona: encuadre y cortes a su medida.
      const framing = !options?.camera && options?.maskRegions?.length && options.view && options.view !== 'current'
        ? zoneFraming(options.maskRegions, options.view, levelHeightM(store.getState().document), allLevels ? levelElevationM(store.getState().document) : 0)
        : null;
      if (!options?.camera && (options?.fit || (options?.view && options.view !== 'current'))) {
        const sequence = ++captureSequence.current;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { cameraApplied.current = null; reject(new Error('No se pudo preparar la cámara.')); }, 5000);
          cameraApplied.current = (applied) => {
            if (applied === sequence) { clearTimeout(timeout); cameraApplied.current = null; resolve(); }
          };
          setRequest({ sequence, action: options?.view && options.view !== 'current' ? options.view : 'fit',
            ...(framing ? { focus: framing.focus } : {}) });
        });
      }
      const currentDocument = store.getState().document;
      const capturedView = options?.view && options.view !== 'current' ? options.view : activeView;
      // «Vista actual» captura lo que se ve; solo un alzado pedido fuerza el recorte.
      const cut = options?.camera ? false : options?.view && options.view !== 'current' ? captureCutaway(options.view, cutaway) : cutaway;
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
      flushSync(() => setCaptureCeilings(options?.camera ? 'solid' : captureCeilingView(
        capturedView,
        { cutaway: cut, forDesign: !fullResolution, cameraHeightM: initial.camera.position.y,
          highestCeilingM: ceilingHeights.length ? Math.max(...ceilingHeights) : null },
      )));
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
      if (framing) state.gl.clippingPlanes = framing.planes.map((plane) => new Plane(new Vector3(...plane.normal), plane.constant));
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
        flushSync(() => { setLighting(originalLighting); setCaptureCeilings(null); setCapturingPose(false); });
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
  }, [onCaptureReady, rendererReady, contextLost, store, activeView, allLevels, cutaway, scene, lighting]);
  const otherLevels = useMemo(() => allLevels ? buildingDocuments(document).filter((l) => l.id !== document.activeLevelId)
    .map((l) => ({ ...l, scene: editorDocumentToScene(l.document) })) : [], [document, allLevels]);
  const ceilingIssues = useMemo(() => computeCeilingIssues(document), [document]);
  // Avisos con el elemento al que apuntan: el nombre es un enlace que lo selecciona para revisarlo.
  const notices: CeilingIssue[] = [...scene.warnings.map((message) => ({ label: 'Plano', message })), ...ceilingIssues];
  const noticeKey = notices.map((n) => `${n.id ?? ''}:${n.message}`).join('|');
  const lightBudgets = useMemo(() => {
    const used = [document, ...otherLevels.map((level) => level.document)]
      .map((doc) => resolvedLuminaires(doc).filter(({ luminaire }) => luminaire.enabled).length);
    return otherLevels.map((_, index) => Math.max(0,
      MAX_LUMINAIRE_LIGHTS - used.slice(0, index + 1).reduce((sum, count) => sum + count, 0)));
  }, [document, otherLevels]);
  const activeElevation = allLevels ? buildingDocuments(document).find((l) => l.id === document.activeLevelId)?.elevationMm ?? 0 : 0;
  const lost = useCallback(() => setContextLost(true), []);
  const manualCameraChange = useCallback(() => setActiveView(null), []);
  const sceneVersion = useMemo(() => ({ scene, otherLevels, activeElevation }), [scene, otherLevels, activeElevation]);
  const select = (id: string) => {
    if (!abortRecording.current) {
      store.getState().select([id]);
      if (id.startsWith('room:')) store.getState().setDetailPanel('paint');
    }
  };
  const camera = (action: SceneViewAction) => {
    if (abortRecording.current || walking) return;
    if (action === 'top' || action === 'isometric' || action === 'front' || action === 'back' || action === 'left' || action === 'right' || action === 'drone') setActiveView(action);
    setRequest((r) => ({ sequence: r.sequence + 1, action: action as CameraRequest['action'] }));
  };
  const exportNativeRender = async () => {
    const capture = captureRender.current;
    if (!capture || exporting || abortRecording.current || walking) return;
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
  const exportWalk = async () => {
    if (!route || !root.current || recording || exporting) return;
    const frozen = store.getState().document, selectionBefore = [...store.getState().selection];
    const controller = new AbortController(); abortRecording.current = controller;
    store.getState().setWalkthroughPlaying(false); store.getState().select([]);
    const unsubscribe = store.subscribe((next) => { if (next.document !== frozen) controller.abort(); });
    flushSync(() => { setRecording(true); setRecordProgress(0); setExportMessage(null); });
    try {
      const job = captureQueue.current.then(async () => {
        controller.signal.throwIfAborted();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return recordWalkthrough(root.current!.get(), frozen, route, activeElevation, controller.signal, setRecordProgress);
      });
      captureQueue.current = job.catch(() => undefined);
      const blob = await job;
      const url = URL.createObjectURL(blob), link = window.document.createElement('a');
      link.href = url; link.download = 'habiteka-recorrido.mp4'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportMessage('MP4 descargado.');
      if (onSaveNativeVideo) { await onSaveNativeVideo(blob, route.id); setExportMessage('MP4 descargado y guardado en Diseños.'); }
    } catch (error) { setExportMessage(controller.signal.aborted ? 'Exportación cancelada.' : error instanceof Error ? error.message : 'No se pudo exportar'); }
    finally { unsubscribe(); setRecording(false); store.getState().select(selectionBefore); abortRecording.current = null; }
  };
  if (contextLost) return <div role="alert" style={{ padding: 24 }}>
    <p>Se interrumpió la vista 3D. El documento permanece disponible en 2D.</p>
    <button type="button" onClick={() => setContextLost(false)}>Reintentar vista 3D</button>
  </div>;
  return <div style={{ height: '100%', minHeight: 320, position: 'relative', background: '#edf2ef' }} aria-label="Vista 3D del plano">
    {route && <div style={{ position: 'absolute', zIndex: 5, bottom: 75, left: 24, padding: 12, borderRadius: 8, background: '#fff', color: '#22362e', display: 'flex', gap: 12, alignItems: 'center' }} aria-label="Reproducir recorrido">
      <strong>{route.name}</strong>
      <button type="button" disabled={recording} onClick={() => store.getState().hideWalkthrough()}>Ocultar recorrido</button>
      <button type="button" disabled={recording} onClick={() => {
        try {
          const result = buildWalkthrough(document, route);
          if (result.invalidSegments.length) throw new Error('La ruta cruza obstáculos. Ajusta los puntos del recorrido.');
          store.getState().setWalkthroughPlaying(!walking);
        } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Ruta inválida'); }
      }}>{walking ? 'Detener' : 'Reproducir'}</button>
      <button type="button" disabled={recording || walking || exporting || store.getState().readOnly} onClick={() => void exportWalk()}>Exportar MP4 · 1080p</button>
      {recording && <><span role="status">{recordProgress >= 1 ? 'Guardando…' : `${Math.round(recordProgress * 100)} %`}</span><button type="button" disabled={recordProgress >= 1} onClick={() => abortRecording.current?.abort()}>Cancelar</button></>}
    </div>}
    <Canvas frameloop="demand" shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true }}
      onCreated={(state) => { root.current = state; setRendererReady(true); }} camera={{ position: [8, 8, 10], fov: 45, near: .01, far: 500 }}
      fallback={rendererReady ? null : unavailable} onPointerMissed={() => store.getState().select([])}>
      <SceneLighting key={lighting} preset={lighting} hasLuminaires={[document, ...otherLevels.map((level) => level.document)]
        .some((levelDocument) => resolvedLuminaires(levelDocument).length > 0)} />
      <Bounds>
        <group position={[0, activeElevation / 1000, 0]}>
          <OutdoorLighting document={document} />
          <group visible={showLighting} userData={{ lightingLayer: true }}>
            <CeilingLightingMeshes document={document} view={walking || recording ? 'solid' : captureCeilings ?? ceilingView} selection={selection} onSelect={select} />
          </group>
          {scene.polygons.map((polygon) => <CutawayWall key={polygon.id} cuttable={polygon.role !== 'floor'} enabled={!walking && !recording && !capturingPose && cutaway && polygon.role !== 'floor'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === polygon.sourceEntityId)} selected={selection.includes(polygon.sourceEntityId)}>
            <PolygonMesh polygon={polygon} selected={selection.includes(polygon.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.boxes.filter((box) => !modeled.has(box.sourceEntityId)).map((box) => {
            // Marco, hoja y cristal de un hueco se recortan con su muro: si no, quedan flotando.
            const hostWallId = openingHosts.get(box.sourceEntityId), cuttable = box.role === 'wall' || hostWallId !== undefined;
            return <CutawayWall key={box.id} cuttable={cuttable} enabled={!walking && !recording && !capturingPose && cutaway && cuttable}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === (hostWallId ?? box.sourceEntityId))} selected={selection.includes(box.sourceEntityId)}>
            <BoxMesh box={box} selected={selection.includes(box.sourceEntityId)} onSelect={select} />
          </CutawayWall>;
          })}
          {scene.ramps.map((ramp) => <RampMesh key={ramp.id} ramp={ramp} selected={selection.includes(ramp.sourceEntityId)} onSelect={select} />)}
          {document.furniture.filter((item) => modeled.has(item.id)).map((item) => <FurnitureModel key={item.id} item={item}
            boxes={scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={selection.includes(item.id)} onSelect={select} />)}
        </group>
        {otherLevels.filter(() => Boolean(document.levels)).map((level, index) => <group key={level.id} position={[0, level.elevationMm / 1000, 0]}>
          <group visible={showLighting} userData={{ lightingLayer: true }}>
            <CeilingLightingMeshes document={level.document} view={walking || recording ? 'solid' : captureCeilings ?? ceilingView} lightBudget={lightBudgets[index]} />
          </group>
          {level.scene.polygons.map((polygon) => <PolygonMesh key={polygon.id} polygon={polygon} selected={false} onSelect={() => {}} />)}
          {level.scene.boxes.filter((box) => !level.document.furniture.some((item) => item.id === box.sourceEntityId && furnitureAsset(item)))
            .map((box) => <BoxMesh key={box.id} box={box} selected={false} onSelect={() => {}} />)}
          {level.scene.ramps.map((ramp) => <RampMesh key={ramp.id} ramp={ramp} selected={false} onSelect={() => {}} />)}
          {level.document.furniture.filter((item) => furnitureAsset(item)).map((item) => <FurnitureModel key={item.id} item={item}
            boxes={level.scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={false} onSelect={() => {}} />)}
        </group>)}
        <WalkCamera store={store} elevationMm={activeElevation} />
        <SceneCamera request={request} sceneVersion={sceneVersion} onManualChange={manualCameraChange} onContextLost={lost} onApplied={onCameraApplied} />
      </Bounds>
      {[...new Set(document.comments?.map((c) => c.targetEntityId) ?? [])].map((id) => {
        const comments = document.comments!.filter((c) => c.targetEntityId === id), p = commentAnchor(document, comments[0]!);
        return p && <Html key={id} position={[p.x / 1000, (p.elevationMm + activeElevation) / 1000 + .15, p.y / 1000]} center>
          <button type="button" aria-label={`Ver ${comments.length} comentarios del elemento`} style={{ background: '#087f75', color: 'white', borderRadius: 20, padding: '4px 10px' }}
            onClick={(e) => { e.stopPropagation(); select(id); store.getState().setDetailPanel('comments'); }}>{comments.length}</button>
        </Html>;
      })}
    </Canvas>
    {!recording && !walking && <SceneViewControls activeView={activeView} hasLevels={Boolean(document.levels)} cutaway={cutaway} allLevels={allLevels} exporting={exporting}
      onCamera={camera} onViewChange={camera} onCutawayChange={() => setCutaway((v) => !v)} onAllLevelsChange={() => setAllLevels((v) => !v)}
      onExport={() => void exportNativeRender()} />}
    <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Iluminación de la escena">
      {(Object.keys(SCENE_LIGHTING_LABELS) as SceneLightingPreset[]).map((preset) => <button key={preset} type="button"
        disabled={recording} aria-pressed={lighting === preset} onClick={() => setLighting(preset)}>{SCENE_LIGHTING_LABELS[preset]}</button>)}
    </div>
    {exportMessage && <div role="status" style={{ position: 'absolute', bottom: 56, left: 16 }}>{exportMessage}</div>}
    {notices.length > 0 && dismissedNotice !== noticeKey && <div role="status" style={{ position: 'absolute', top: 12, left: 16, maxWidth: 420, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-panel)', fontSize: 12 }}>
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
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
  showLighting,
}: {
  store: EditorStore;
  onSaveNativeVideo?: (blob: Blob, routeId: string) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
  showLighting?: boolean;
}) {
  return <SceneErrorBoundary><SceneView store={store} onSaveNativeVideo={onSaveNativeVideo} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady} showLighting={showLighting} /></SceneErrorBoundary>;
}
export default EditorSceneView;
