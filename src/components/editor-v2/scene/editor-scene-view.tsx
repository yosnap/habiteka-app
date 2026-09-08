'use client';
import { Component, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Html } from '@react-three/drei';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { BoxMesh, PolygonMesh } from './scene-meshes';
import { SceneCamera, type CameraRequest } from './scene-camera';
import { CutawayWall } from './cutaway-wall';
import { buildingDocuments } from '@/lib/editor-document/building-levels';

const unavailable = <div role="alert" style={{ padding: 24 }}>No se puede mostrar WebGL. Tu plano sigue disponible en 2D.</div>;
class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div role="alert" style={{ padding: 24 }}>No se pudo mostrar la escena 3D. El documento no se ha modificado; puedes continuar en 2D.</div> : this.props.children; }
}
function SceneView({ store }: { store: EditorStore }) {
  const document = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const scene = useMemo(() => editorDocumentToScene(document), [document]);
  const [request, setRequest] = useState<CameraRequest>({ sequence: 0, action: 'fit' });
  const [contextLost, setContextLost] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const [allLevels, setAllLevels] = useState(false);
  const otherLevels = useMemo(() => allLevels ? buildingDocuments(document).filter((l) => l.id !== document.activeLevelId)
    .map((l) => ({ ...l, scene: editorDocumentToScene(l.document) })) : [], [document, allLevels]);
  const activeElevation = allLevels ? buildingDocuments(document).find((l) => l.id === document.activeLevelId)?.elevationMm ?? 0 : 0;
  const lost = useCallback(() => setContextLost(true), []);
  const select = (id: string) => store.getState().select([id]);
  const camera = (action: CameraRequest['action']) => setRequest((r) => ({ sequence: r.sequence + 1, action }));
  if (contextLost) return <div role="alert" style={{ padding: 24 }}>
    <p>Se interrumpió la vista 3D. El documento permanece disponible en 2D.</p>
    <button type="button" onClick={() => setContextLost(false)}>Reintentar vista 3D</button>
  </div>;
  return <div style={{ height: '100%', minHeight: 320, position: 'relative', background: '#f0f3f1' }} aria-label="Vista 3D del plano">
    <Canvas frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [8, 8, 10], fov: 45, near: .01, far: 500 }}
      fallback={unavailable} onPointerMissed={() => store.getState().select([])}>
      <color attach="background" args={['#f0f3f1']} />
      <ambientLight intensity={1.4} />
      <hemisphereLight args={['#ffffff', '#aaa898', 1.5]} />
      <directionalLight position={[5, 12, 8]} intensity={2} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <Bounds fit clip observe margin={1.3} maxDuration={0}>
        <group position={[0, activeElevation / 1000, 0]}>
          {scene.polygons.map((polygon) => <CutawayWall key={polygon.id} enabled={cutaway && polygon.role !== 'floor'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === polygon.sourceEntityId)} selected={selection.includes(polygon.sourceEntityId)}>
            <PolygonMesh polygon={polygon} selected={selection.includes(polygon.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
          {scene.boxes.map((box) => <CutawayWall key={box.id} enabled={cutaway && box.role === 'wall'}
            exterior={scene.exteriorWalls.find((w) => w.sourceEntityId === box.sourceEntityId)} selected={selection.includes(box.sourceEntityId)}>
            <BoxMesh box={box} selected={selection.includes(box.sourceEntityId)} onSelect={select} />
          </CutawayWall>)}
        </group>
        {otherLevels.filter(() => Boolean(document.levels)).map((level) => <group key={level.id} position={[0, level.elevationMm / 1000, 0]}>
          {level.scene.polygons.map((polygon) => <PolygonMesh key={polygon.id} polygon={polygon} selected={false} onSelect={() => {}} />)}
          {level.scene.boxes.map((box) => <BoxMesh key={box.id} box={box} selected={false} onSelect={() => {}} />)}
        </group>)}
        <SceneCamera request={request} onContextLost={lost} />
      </Bounds>
      {[...new Set(document.comments?.map((c) => c.targetEntityId) ?? [])].map((id) => {
        const comments = document.comments!.filter((c) => c.targetEntityId === id), p = commentAnchor(document, comments[0]!);
        return p && <Html key={id} position={[p.x / 1000, (p.elevationMm + activeElevation) / 1000 + .15, p.y / 1000]} center>
          <button type="button" aria-label={`Ver ${comments.length} comentarios del elemento`} style={{ background: '#087f75', color: 'white', borderRadius: 20, padding: '4px 10px' }}
            onClick={(e) => { e.stopPropagation(); select(id); store.getState().setDetailPanel('comments'); }}>{comments.length}</button>
        </Html>;
      })}
    </Canvas>
    <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Navegación 3D">
      <button type="button" onClick={() => camera('out')} aria-label="Alejar en 3D">−</button>
      <button type="button" onClick={() => camera('in')} aria-label="Acercar en 3D">+</button>
      <button type="button" onClick={() => camera('fit')}>Encuadrar 3D</button>
      <button type="button" aria-pressed={cutaway} onClick={() => setCutaway((v) => !v)}>{cutaway ? 'Mostrar todos los muros' : 'Abrir vista interior'}</button>
      {document.levels && <button type="button" aria-pressed={allLevels} onClick={() => setAllLevels(!allLevels)}>{allLevels ? 'Solo planta activa' : 'Ver todas las plantas'}</button>}
    </div>
    <div style={{ position: 'absolute', top: 12, left: 16, pointerEvents: 'none', fontSize: 12 }}>Arrastra para orbitar · rueda para acercar · clic para seleccionar</div>
    {scene.warnings.length > 0 && <div role="status" style={{ position: 'absolute', top: 36, left: 16 }}>{scene.warnings.join(' · ')}</div>}
  </div>;
}
export function EditorSceneView({ store }: { store: EditorStore }) {
  return <SceneErrorBoundary><SceneView store={store} /></SceneErrorBoundary>;
}
export default EditorSceneView;
