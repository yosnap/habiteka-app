'use client';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { flushSync } from 'react-dom';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { Bounds, Html } from '@react-three/drei';
import { Vector3, PerspectiveCamera } from 'three';
import { cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { BoxMesh, PolygonMesh, RampMesh } from './scene-meshes';
import { SceneCamera, type CameraRequest } from './scene-camera';
import { CutawayWall } from './cutaway-wall';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { FurnitureModel } from './furniture-model';
import { OutdoorLighting } from './outdoor-lighting';
import { WalkCamera } from './walk-camera';
import { recordWalkthrough } from './offline-recorder';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { SceneLighting, SCENE_LIGHTING_LABELS, type SceneLightingPreset } from './scene-lighting';
import { CeilingLightingMeshes } from './ceiling-lighting-meshes';
import { captureCeilingView, MAX_LUMINAIRE_LIGHTS, type CeilingView } from './ceiling-scene-utils';
import { resolvedLuminaires, ceilingWarnings, ceilingSurfaces } from '@/lib/editor-document/ceiling-geometry';
import { SceneViewControls, type SceneViewAction, type SceneViewPreset } from './scene-view-controls';

const unavailable = <div role="alert" style={{ padding: 24 }}>No se puede mostrar WebGL. Tu plano sigue disponible en 2D.</div>;
const MAX_PERSISTED_RENDER_SIDE = 2048;
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
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
}: {
  store: EditorStore;
  onSaveNativeVideo?: (blob: Blob, routeId: string) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
}) {
  const document = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const ceilingView = useStore(store, (s) => s.ceilingView);
  const [captureCeilings, setCaptureCeilings] = useState<CeilingView | null>(null);
  const scene = useMemo(() => editorDocumentToScene(document), [document]);
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
  const [cutaway, setCutaway] = useState(true);
  const [allLevels, setAllLevels] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
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
      const job = captureQueue.current.then(async (): Promise<SceneCapture> => {
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
      const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      try {
      store.getState().select([]);
      if (options?.lighting) flushSync(() => setLighting(options.lighting!));
      if (!options?.camera && (options?.fit || (options?.view && options.view !== 'current'))) {
        const sequence = ++captureSequence.current;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { cameraApplied.current = null; reject(new Error('No se pudo preparar la cámara.')); }, 5000);
          cameraApplied.current = (applied) => {
            if (applied === sequence) { clearTimeout(timeout); cameraApplied.current = null; resolve(); }
          };
          setRequest({ sequence, action: options?.view && options.view !== 'current' ? options.view : 'fit' });
        });
      }
      const currentDocument = store.getState().document;
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
        options?.view && options.view !== 'current' ? options.view : activeView,
        { cutaway, cameraHeightM: initial.camera.position.y,
          highestCeilingM: ceilingHeights.length ? Math.max(...ceilingHeights) : null },
      )));
      await frames();
      const state = root.current?.get();
      if (!state || state.gl.getContext().isContextLost()) throw new Error('La vista 3D no está disponible.');
      state.gl.render(state.scene, state.camera);
      const camera = state.camera;
      if (!('fov' in camera) || typeof camera.fov !== 'number') throw new Error('Cámara no compatible.');
      return { dataUrl: captureForPersistence(state.gl.domElement),
        ...(fullResolution ? { downloadDataUrl: state.gl.domElement.toDataURL('image/png') } : {}), view: {
        preset: options?.camera ? 'custom' : options?.view && options.view !== 'current' ? options.view : activeView ?? 'custom', focus: camera.position.clone().add(camera.getWorldDirection(new Vector3())).toArray(), levelId: currentDocument.activeLevelId ?? null, levelElevationM: allLevels ? (buildingDocuments(currentDocument).find((level) => level.id === currentDocument.activeLevelId)?.elevationMm ?? 0) / 1000 : 0, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        fov: camera.fov, aspect: state.size.width / state.size.height, allLevels, cutaway: options?.camera ? false : cutaway,
        lighting: options?.lighting ?? originalLighting,
        cutawayWallIds: !options?.camera && cutaway ? scene.exteriorWalls.filter((wall) =>
          (camera.position.x - wall.x) * wall.normalX + (camera.position.z - wall.z) * wall.normalZ > .01,
        ).map((wall) => wall.sourceEntityId) : [],
      } };
      } finally {
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
      captureQueue.current = job.catch(() => undefined);
      return job;
    };
    captureRender.current = capture;
    onCaptureReady?.(capture);
    return () => { captureRender.current = null; onCaptureReady?.(null); };
  }, [onCaptureReady, rendererReady, contextLost, store, activeView, allLevels, cutaway, scene, lighting]);
  const otherLevels = useMemo(() => allLevels ? buildingDocuments(document).filter((l) => l.id !== document.activeLevelId)
    .map((l) => ({ ...l, scene: editorDocumentToScene(l.document) })) : [], [document, allLevels]);
  const ceilingIssues = useMemo(() => ceilingWarnings(document), [document]);
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
          <CeilingLightingMeshes document={document} view={walking || recording ? 'solid' : captureCeilings ?? ceilingView} selection={selection} onSelect={select} />
          {scene.polygons.map((polygon) => <CutawayWall key={polygon.id} enabled={!walking && !recording && !capturingPose && cutaway && polygon.role !== 'floor'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === polygon.sourceEntityId)} selected={selection.includes(polygon.sourceEntityId)}>
            <PolygonMesh polygon={polygon} selected={selection.includes(polygon.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.boxes.filter((box) => !modeled.has(box.sourceEntityId)).map((box) => <CutawayWall key={box.id} enabled={!walking && !recording && !capturingPose && cutaway && box.role === 'wall'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === box.sourceEntityId)} selected={selection.includes(box.sourceEntityId)}>
            <BoxMesh box={box} selected={selection.includes(box.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.ramps.map((ramp) => <RampMesh key={ramp.id} ramp={ramp} selected={selection.includes(ramp.sourceEntityId)} onSelect={select} />)}
          {document.furniture.filter((item) => modeled.has(item.id)).map((item) => <FurnitureModel key={item.id} item={item}
            boxes={scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={selection.includes(item.id)} onSelect={select} />)}
        </group>
        {otherLevels.filter(() => Boolean(document.levels)).map((level, index) => <group key={level.id} position={[0, level.elevationMm / 1000, 0]}>
          <CeilingLightingMeshes document={level.document} view={walking || recording ? 'solid' : captureCeilings ?? ceilingView} lightBudget={lightBudgets[index]} />
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
    <div style={{ position: 'absolute', top: 12, left: 16, pointerEvents: 'none', fontSize: 12 }}>Arrastra para orbitar · rueda para acercar · clic para seleccionar</div>
    {(scene.warnings.length > 0 || ceilingIssues.length > 0) && <div role="status" style={{ position: 'absolute', top: 36, left: 16 }}>{[...scene.warnings, ...ceilingIssues].join(' · ')}</div>}
  </div>;
}
export function EditorSceneView({
  store,
  onSaveNativeVideo,
  onSaveNativeRender,
  onCaptureReady,
}: {
  store: EditorStore;
  onSaveNativeVideo?: (blob: Blob, routeId: string) => Promise<void>;
  onSaveNativeRender?: (capture: RenderCapture) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
}) {
  return <SceneErrorBoundary><SceneView store={store} onSaveNativeVideo={onSaveNativeVideo} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady} /></SceneErrorBoundary>;
}
export default EditorSceneView;
