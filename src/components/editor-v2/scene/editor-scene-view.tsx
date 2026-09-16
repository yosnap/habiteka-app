'use client';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { flushSync } from 'react-dom';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { Bounds, Html } from '@react-three/drei';
import type { WebGLRenderer, Vector3 } from 'three';
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
import { SceneLighting, SCENE_LIGHTING_LABELS, type SceneLightingPreset } from './scene-lighting';
import { SceneViewControls, type SceneViewAction, type SceneViewPreset } from './scene-view-controls';

const unavailable = <div role="alert" style={{ padding: 24 }}>No se puede mostrar WebGL. Tu plano sigue disponible en 2D.</div>;
const MAX_PERSISTED_RENDER_SIDE = 2048;

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
  onSaveNativeRender,
  onCaptureReady,
}: {
  store: EditorStore;
  onSaveNativeRender?: (captureDataUrl: string) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
}) {
  const document = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const scene = useMemo(() => editorDocumentToScene(document), [document]);
  const modeled = useMemo(() => new Set(document.furniture.filter((item) => furnitureAsset(item)).map((item) => item.id)), [document]);
  const [request, setRequest] = useState<CameraRequest>({ sequence: 0, action: 'fit' });
  const [activeView, setActiveView] = useState<SceneViewPreset | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const [allLevels, setAllLevels] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [lighting, setLighting] = useState<SceneLightingPreset>('daylight');
  const lightingRef = useRef(lighting);
  useEffect(() => { lightingRef.current = lighting; }, [lighting]);
  const renderer = useRef<WebGLRenderer | null>(null);
  const root = useRef<RootState | null>(null);
  const captureSequence = useRef(1000000);
  const captureQueue = useRef<Promise<unknown>>(Promise.resolve());
  const cameraApplied = useRef<((sequence: number) => void) | null>(null);
  const onCameraApplied = useCallback((sequence: number) => cameraApplied.current?.(sequence), []);
  useEffect(() => {
    if (!rendererReady || contextLost) { onCaptureReady?.(null); return; }
    onCaptureReady?.((options) => {
      const job = captureQueue.current.then(async (): Promise<RenderCapture> => {
      const initial = root.current?.get();
      if (!initial) throw new Error('La vista 3D no está disponible.');
      const originalPosition = initial.camera.position.clone();
      const originalQuaternion = initial.camera.quaternion.clone();
      const originalLighting = lightingRef.current;
      const originalNear = initial.camera.near, originalFar = initial.camera.far;
      const controls = initial.controls as unknown as { target: Vector3; update: () => void } | null;
      const originalTarget = controls?.target.clone();
      const originalSelection = [...store.getState().selection];
      const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      try {
      store.getState().select([]);
      if (options?.lighting) flushSync(() => setLighting(options.lighting!));
      if (options?.fit || (options?.view && options.view !== 'current')) {
        const sequence = ++captureSequence.current;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { cameraApplied.current = null; reject(new Error('No se pudo preparar la cámara.')); }, 5000);
          cameraApplied.current = (applied) => {
            if (applied === sequence) { clearTimeout(timeout); cameraApplied.current = null; resolve(); }
          };
          setRequest({ sequence, action: options?.view && options.view !== 'current' ? options.view : 'fit' });
        });
      }
      await frames();
      const state = root.current?.get();
      if (!state || state.gl.getContext().isContextLost()) throw new Error('La vista 3D no está disponible.');
      state.gl.render(state.scene, state.camera);
      const camera = state.camera;
      if (!('fov' in camera) || typeof camera.fov !== 'number') throw new Error('Cámara no compatible.');
      return { dataUrl: captureForPersistence(state.gl.domElement), view: {
        preset: options?.view && options.view !== 'current' ? options.view : activeView ?? 'custom', position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        fov: camera.fov, aspect: state.size.width / state.size.height, allLevels, cutaway,
        lighting: options?.lighting ?? originalLighting,
        cutawayWallIds: cutaway ? scene.exteriorWalls.filter((wall) =>
          (camera.position.x - wall.x) * wall.normalX + (camera.position.z - wall.z) * wall.normalZ > .01,
        ).map((wall) => wall.sourceEntityId) : [],
      } };
      } finally {
        initial.camera.position.copy(originalPosition);
        initial.camera.quaternion.copy(originalQuaternion);
        initial.camera.near = originalNear;
        initial.camera.far = originalFar;
        initial.camera.updateProjectionMatrix();
        if (controls && originalTarget) { controls.target.copy(originalTarget); controls.update(); }
        flushSync(() => setLighting(originalLighting));
        store.getState().select(originalSelection);
        initial.invalidate();
        await frames();
      }
      });
      captureQueue.current = job.catch(() => undefined);
      return job;
    });
    return () => onCaptureReady?.(null);
  }, [onCaptureReady, rendererReady, contextLost, store, activeView, allLevels, cutaway, scene, lighting]);
  const otherLevels = useMemo(() => allLevels ? buildingDocuments(document).filter((l) => l.id !== document.activeLevelId)
    .map((l) => ({ ...l, scene: editorDocumentToScene(l.document) })) : [], [document, allLevels]);
  const activeElevation = allLevels ? buildingDocuments(document).find((l) => l.id === document.activeLevelId)?.elevationMm ?? 0 : 0;
  const lost = useCallback(() => setContextLost(true), []);
  const manualCameraChange = useCallback(() => setActiveView(null), []);
  const sceneVersion = useMemo(() => ({ scene, otherLevels, activeElevation }), [scene, otherLevels, activeElevation]);
  const select = (id: string) => store.getState().select([id]);
  const camera = (action: SceneViewAction) => {
    if (action === 'top' || action === 'isometric' || action === 'front' || action === 'back' || action === 'left' || action === 'right' || action === 'drone') setActiveView(action);
    setRequest((r) => ({ sequence: r.sequence + 1, action: action as CameraRequest['action'] }));
  };
  const exportNativeRender = async () => {
    const canvas = renderer.current?.domElement;
    if (!canvas || exporting) return;
    setExporting(true);
    // La captura sale del canvas WebGL: no incluye controles, comentarios ni UI.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const captureDataUrl = canvas.toDataURL('image/png');
    const download = window.document.createElement('a');
    download.href = captureDataUrl;
    download.download = `habiteka-render-nativo-${new Date().toISOString().slice(0, 10)}.png`;
    download.click();
    try {
      await onSaveNativeRender?.(captureForPersistence(canvas));
      setExportMessage(onSaveNativeRender ? 'Render guardado en Diseños.' : 'PNG descargado.');
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
      setExportMessage(`El PNG se descargó, pero no se pudo guardar en Diseños.${detail}`);
    }
    setExporting(false);
  };
  if (contextLost) return <div role="alert" style={{ padding: 24 }}>
    <p>Se interrumpió la vista 3D. El documento permanece disponible en 2D.</p>
    <button type="button" onClick={() => setContextLost(false)}>Reintentar vista 3D</button>
  </div>;
  return <div style={{ height: '100%', minHeight: 320, position: 'relative', background: '#edf2ef' }} aria-label="Vista 3D del plano">
    <Canvas frameloop="demand" shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true }}
      onCreated={(state) => { root.current = state; renderer.current = state.gl; setRendererReady(true); }} camera={{ position: [8, 8, 10], fov: 45, near: .01, far: 500 }}
      fallback={rendererReady ? null : unavailable} onPointerMissed={() => store.getState().select([])}>
      <SceneLighting key={lighting} preset={lighting} />
      <Bounds>
        <group position={[0, activeElevation / 1000, 0]}>
          {scene.polygons.map((polygon) => <CutawayWall key={polygon.id} enabled={cutaway && polygon.role !== 'floor'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === polygon.sourceEntityId)} selected={selection.includes(polygon.sourceEntityId)}>
            <PolygonMesh polygon={polygon} selected={selection.includes(polygon.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.boxes.filter((box) => !modeled.has(box.sourceEntityId)).map((box) => <CutawayWall key={box.id} enabled={cutaway && box.role === 'wall'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === box.sourceEntityId)} selected={selection.includes(box.sourceEntityId)}>
            <BoxMesh box={box} selected={selection.includes(box.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.ramps.map((ramp) => <RampMesh key={ramp.id} ramp={ramp} selected={selection.includes(ramp.sourceEntityId)} onSelect={select} />)}
          {document.furniture.filter((item) => modeled.has(item.id)).map((item) => <FurnitureModel key={item.id} item={item}
            boxes={scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={selection.includes(item.id)} onSelect={select} />)}
        </group>
        {otherLevels.filter(() => Boolean(document.levels)).map((level) => <group key={level.id} position={[0, level.elevationMm / 1000, 0]}>
          {level.scene.polygons.map((polygon) => <PolygonMesh key={polygon.id} polygon={polygon} selected={false} onSelect={() => {}} />)}
          {level.scene.boxes.filter((box) => !level.document.furniture.some((item) => item.id === box.sourceEntityId && furnitureAsset(item)))
            .map((box) => <BoxMesh key={box.id} box={box} selected={false} onSelect={() => {}} />)}
          {level.scene.ramps.map((ramp) => <RampMesh key={ramp.id} ramp={ramp} selected={false} onSelect={() => {}} />)}
          {level.document.furniture.filter((item) => furnitureAsset(item)).map((item) => <FurnitureModel key={item.id} item={item}
            boxes={level.scene.boxes.filter((box) => box.sourceEntityId === item.id)} selected={false} onSelect={() => {}} />)}
        </group>)}
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
    <SceneViewControls activeView={activeView} hasLevels={Boolean(document.levels)} cutaway={cutaway} allLevels={allLevels} exporting={exporting}
      onCamera={camera} onViewChange={camera} onCutawayChange={() => setCutaway((v) => !v)} onAllLevelsChange={() => setAllLevels((v) => !v)}
      onExport={() => void exportNativeRender()} />
    <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Iluminación de la escena">
      {(Object.keys(SCENE_LIGHTING_LABELS) as SceneLightingPreset[]).map((preset) => <button key={preset} type="button"
        aria-pressed={lighting === preset} onClick={() => setLighting(preset)}>{SCENE_LIGHTING_LABELS[preset]}</button>)}
    </div>
    {exportMessage && <div role="status" style={{ position: 'absolute', bottom: 56, left: 16 }}>{exportMessage}</div>}
    <div style={{ position: 'absolute', top: 12, left: 16, pointerEvents: 'none', fontSize: 12 }}>Arrastra para orbitar · rueda para acercar · clic para seleccionar</div>
    {scene.warnings.length > 0 && <div role="status" style={{ position: 'absolute', top: 36, left: 16 }}>{scene.warnings.join(' · ')}</div>}
  </div>;
}
export function EditorSceneView({
  store,
  onSaveNativeRender,
  onCaptureReady,
}: {
  store: EditorStore;
  onSaveNativeRender?: (captureDataUrl: string) => Promise<void>;
  onCaptureReady?: (capture: CaptureRenderView | null) => void;
}) {
  return <SceneErrorBoundary><SceneView store={store} onSaveNativeRender={onSaveNativeRender} onCaptureReady={onCaptureReady} /></SceneErrorBoundary>;
}
export default EditorSceneView;
