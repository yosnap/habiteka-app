'use client';

/**
 * Vista 3D navegable de una sala a partir de un `CanvasDoc` (F6.1).
 *
 * El render es "tonto": toda la geometría (suelo + muros en metros, mapeo de ejes
 * px→m y 2D→3D) la calcula `docToScene` (lógica pura testeada). Este componente solo
 * dibuja lo que recibe. Los muebles glTF y las luces del doc llegan en F6.2/F6.3.
 *
 * Cliente-only: WebGL necesita `window`; se monta con `dynamic` desde la página.
 */
import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF } from '@react-three/drei';
import { Mesh, Shape } from 'three';
import type { CanvasDoc } from '@/canvas/types';
import { docToScene, shouldHideWallXZ, type Scene3D, type WallBox } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl } from '@/canvas/3d/furniture-models';
import { useMountEffect } from '@/lib/use-mount-effect';
import { FurnitureLayer } from './furniture-layer';
import { LightsLayer } from './lights-layer';
import { GlassLayer } from './glass-layer';
import { OpeningFramesLayer } from './opening-frames-layer';

/**
 * Muros con recorte por cámara (F6.4): cada frame se oculta el muro que queda entre la
 * cámara y el interior (estilo Planner5D/Sims), para poder ver dentro al orbitar. La
 * decisión es lógica pura (`shouldHideWall`); aquí solo se aplica `visible` por muro.
 */
function Walls({ walls }: { walls: WallBox[] }) {
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame((state) => {
    const cam = state.camera.position;
    for (let i = 0; i < walls.length; i++) {
      const mesh = refs.current[i];
      const w = walls[i];
      if (!mesh || !w) continue;
      mesh.visible = !shouldHideWallXZ(w.center[0], w.center[2], cam.x, cam.z);
    }
  });
  return (
    <group>
      {walls.map((w, i) => (
        <mesh
          key={w.id}
          ref={(m) => {
            refs.current[i] = m;
          }}
          position={w.center}
          rotation={[0, w.rotationY, 0]}
        >
          <boxGeometry args={w.size} />
          <meshStandardMaterial color="#b7c3cf" />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Suelo del plano: polígono exacto (formas L/U/T, vía `floor.polygon`) o rectángulo
 * (caso por defecto). Ambos se tumban al plano XZ rotando −90° en X; con esa rotación un
 * punto (u,v) de la `Shape` cae en (u, 0, −v) del mundo, así que la coordenada Z del
 * polígono se NIEGA al construir la forma para que el suelo quede alineado con los muros.
 * El polígono se memoiza por sus vértices para no reconstruir la geometría en cada frame.
 */
function Floor({ floor }: { floor: Scene3D['floor'] }) {
  const shape = useMemo(() => {
    const poly = floor.polygon;
    if (!poly || poly.length < 3) return null;
    const first = poly[0];
    if (!first) return null;
    const s = new Shape();
    s.moveTo(first[0], -first[1]);
    for (let i = 1; i < poly.length; i++) {
      const p = poly[i];
      if (p) s.lineTo(p[0], -p[1]);
    }
    s.closePath();
    return s;
  }, [floor.polygon]);

  if (shape) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#d8d2c8" />
      </mesh>
    );
  }
  // Un doc sin objetos da suelo [0,0] (geometría degenerada): no lo renderizamos.
  const hasFloor = floor.size[0] > 0 && floor.size[1] > 0;
  if (!hasFloor) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floor.center[0], 0, floor.center[1]]}>
      <planeGeometry args={[floor.size[0], floor.size[1]]} />
      <meshStandardMaterial color="#d8d2c8" />
    </mesh>
  );
}

/** Suelo + muros del plano, ya convertidos a metros por `docToScene`. */
function RoomMesh({ scene }: { scene: Scene3D }) {
  return (
    <group>
      <Floor floor={scene.floor} />
      <Walls walls={scene.walls} />
    </group>
  );
}

interface PerfStats {
  fps: number;
  /** Llamadas de dibujo del último frame (coste de render real). */
  calls: number;
  /** Triángulos del último frame. */
  tris: number;
}

/**
 * Sonda de rendimiento: FPS (media móvil sobre los deltas de frame) + draw calls y
 * triángulos de `gl.info.render`. Útil para verificación visual y para la medición
 * de rendimiento de F6.5.
 */
function PerfProbe({ onStats }: { onStats: (s: PerfStats) => void }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, elapsed: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.elapsed += delta;
    if (a.elapsed >= 0.5) {
      onStats({
        fps: Math.round(a.frames / a.elapsed),
        calls: gl.info.render.calls,
        tris: gl.info.render.triangles,
      });
      a.frames = 0;
      a.elapsed = 0;
    }
  });
  return null;
}

export function Plan3DView({ doc }: { doc: CanvasDoc }) {
  // La escena depende solo del doc: memoizar evita recalcular en cada render.
  const scene = useMemo(() => docToScene(doc), [doc]);
  const [stats, setStats] = useState<PerfStats>({ fps: 0, calls: 0, tris: 0 });

  // Precarga SOLO los modelos de los kinds presentes en esta escena (no todos), al
  // montar: evita bajar .glb que no se usan y mantiene el side-effect fuera del módulo.
  useMountEffect(() => {
    const urls = new Set<string>();
    for (const f of scene.furniture) {
      const url = furnitureModelUrl(f.kind);
      if (url) urls.add(url);
    }
    urls.forEach((url) => useGLTF.preload(url));
  });

  // Distancia de cámara orientativa según el tamaño del plano.
  const span = Math.max(scene.floor.size[0], scene.floor.size[1], 4);

  // Si el plano define luces propias, se atenúa la luz base para que se noten; sin
  // luces del doc, la base ilumina la escena por completo (no queda a oscuras).
  const hasDocLights = scene.lights.length > 0;

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/70 px-3 py-1.5 font-mono text-sm text-white">
        FPS:{' '}
        <span className={stats.fps >= 30 ? 'text-green-400' : 'text-red-400'}>
          {stats.fps || '—'}
        </span>
        <span className="ml-2 text-white/60">
          {scene.walls.length} muros · {scene.furniture.length} muebles · {scene.lights.length}{' '}
          luces · suelo {scene.floor.size[0].toFixed(1)}×{scene.floor.size[1].toFixed(1)} m ·{' '}
          {stats.calls} draw calls · {stats.tris.toLocaleString()} tris
        </span>
      </div>
      <Canvas
        shadows={false}
        camera={{ position: [span * 0.9, span * 0.8, span * 0.9], fov: 50 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#eef1f4']} />
        {/* Ambiente base: hemisférica (cielo/suelo) + ambiental + direccional suave. Da
            relieve sin HDRI externo (robusto offline/build). Se atenúa si el doc trae luces. */}
        <hemisphereLight args={['#eef1f4', '#b8b0a4', hasDocLights ? 0.3 : 0.9]} />
        <ambientLight intensity={hasDocLights ? 0.12 : 0.6} />
        <directionalLight position={[10, 15, 8]} intensity={hasDocLights ? 0.3 : 1.1} />
        <LightsLayer items={scene.lights} />
        <RoomMesh scene={scene} />
        <GlassLayer panes={scene.glassPanes} />
        <OpeningFramesLayer frames={scene.openingFrames} />
        <Suspense fallback={null}>
          <FurnitureLayer items={scene.furniture} />
        </Suspense>
        <Grid
          args={[span * 3, span * 3]}
          cellSize={1}
          cellColor="#c7ccd1"
          sectionSize={5}
          sectionColor="#9aa3ab"
          position={[0, -0.01, 0]}
          infiniteGrid={false}
        />
        <OrbitControls makeDefault target={[0, scene.ceilingHeightM / 2, 0]} />
        <PerfProbe onStats={setStats} />
      </Canvas>
    </div>
  );
}
