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
import { Mesh, Shape, type PerspectiveCamera } from 'three';
import type { CanvasDoc } from '@/canvas/types';
import { docToScene, shouldHideWallXZ, type Scene3D, type WallBox } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl } from '@/canvas/3d/furniture-models';
import { cameraForAngle, type ViewAngle } from '@/canvas/3d/camera-views';
import { useMountEffect } from '@/lib/use-mount-effect';
import type { SelectionMode } from './use-3d-selection';
import { TransformGizmo } from './transform-gizmo';
import { FurnitureLayer } from './furniture-layer';
import { LightsLayer } from './lights-layer';
import { GlassLayer } from './glass-layer';
import { OpeningFramesLayer } from './opening-frames-layer';

/**
 * Muros con recorte por cámara (F6.4): cada frame se oculta el muro que queda entre la
 * cámara y el interior (estilo Planner5D/Sims), para poder ver dentro al orbitar. La
 * decisión es lógica pura (`shouldHideWall`); aquí solo se aplica `visible` por muro.
 */
const DEFAULT_WALL_COLOR = '#b7c3cf';

function Walls({
  walls,
  onPick,
}: {
  walls: WallBox[];
  /** Clic derecho sobre un muro: id del objeto muro + posición en pantalla (para el menú). */
  onPick?: (sourceId: string, screenX: number, screenY: number) => void;
}) {
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
          onContextMenu={(e) => {
            if (!onPick) return;
            e.stopPropagation();
            e.nativeEvent.preventDefault();
            onPick(w.sourceId ?? w.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
          }}
        >
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={w.color ?? DEFAULT_WALL_COLOR} />
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
function RoomMesh({
  scene,
  onPickWall,
}: {
  scene: Scene3D;
  onPickWall?: (sourceId: string, screenX: number, screenY: number) => void;
}) {
  return (
    <group>
      <Floor floor={scene.floor} />
      <Walls walls={scene.walls} onPick={onPickWall} />
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

/** Orden de captura: el ángulo a fijar + a quién devolver el data URL del frame. */
interface CaptureOrder {
  angle: ViewAngle;
  span: number;
  ceiling: number;
  resolve: (dataUrl: string) => void;
}

/**
 * Coloca la cámara en el ángulo pedido y captura el canvas WebGL a data URL (PNG). Vive
 * DENTRO del Canvas para acceder a `gl`/`camera` con `useThree`. La captura se hace en el
 * `useFrame` siguiente a recibir la orden, tras recolocar la cámara y forzar un render, para
 * que el buffer tenga el encuadre correcto (requiere `preserveDrawingBuffer` en el Canvas).
 */
function CaptureRig({ order }: { order: CaptureOrder | null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  // Marca de la orden ya servida, para no capturar dos veces la misma. Se actualiza DENTRO
  // del frame (no en render), evitando el anti-patrón de mutar un ref durante el render.
  const servedRef = useRef<CaptureOrder | null>(null);

  useFrame(() => {
    if (!order || servedRef.current === order) return;
    servedRef.current = order;
    const view = cameraForAngle(order.angle, order.span, order.ceiling);
    camera.position.set(...view.position);
    camera.lookAt(...view.target);
    camera.updateProjectionMatrix();
    gl.render(scene, camera); // re-render con el encuadre fijado antes de leer el buffer
    order.resolve(gl.domElement.toDataURL('image/png'));
  });
  return null;
}

export function Plan3DView({
  doc,
  onGenerateView,
  onPickWall,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
}: {
  doc: CanvasDoc;
  /** Si se pasa, habilita capturar vistas por ángulo y entregar el data URL al caller. */
  onGenerateView?: (dataUrl: string, angle: ViewAngle) => void;
  /** Clic derecho sobre un muro: id del muro + posición en pantalla (para editar en 3D). */
  onPickWall?: (sourceId: string, screenX: number, screenY: number) => void;
  /** Selección 3D (F1 editor). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  mode?: SelectionMode;
  onSetMode?: (m: SelectionMode) => void;
}) {
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

  // Captura de vista por ángulo: se fija una "orden" que el CaptureRig ejecuta en el
  // siguiente frame (recoloca la cámara + lee el buffer). El data URL se entrega al caller.
  const [captureOrder, setCaptureOrder] = useState<CaptureOrder | null>(null);
  const captureView = (angle: ViewAngle) => {
    if (!onGenerateView) return;
    setCaptureOrder({
      angle,
      span,
      ceiling: scene.ceilingHeightM,
      resolve: (dataUrl) => {
        setCaptureOrder(null);
        onGenerateView(dataUrl, angle);
      },
    });
  };

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
      {/* Barra de captura de vistas (solo si el caller pide vistas). Sobre el Canvas. */}
      {onGenerateView ? (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          {(['perspectiva', 'isometrica', 'cenital'] as const).map((angle) => (
            <button
              key={angle}
              type="button"
              onClick={() => captureView(angle)}
              disabled={captureOrder !== null}
              className="rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 disabled:opacity-50"
            >
              {angle === 'perspectiva' ? 'Perspectiva' : angle === 'isometrica' ? 'Isométrica' : 'Cenital'}
            </button>
          ))}
        </div>
      ) : null}
      <Canvas
        shadows={false}
        camera={{ position: [span * 0.9, span * 0.8, span * 0.9], fov: 50 }}
        dpr={[1, 2]}
        // Necesario para capturar el frame a imagen (toDataURL); sin esto el buffer se
        // limpia tras pintar y la captura saldría en negro.
        gl={{ preserveDrawingBuffer: true }}
        // Clic en espacio vacío deselecciona el mueble seleccionado (F1).
        onPointerMissed={onDeselect}
      >
        <color attach="background" args={['#eef1f4']} />
        {/* Ambiente base: hemisférica (cielo/suelo) + ambiental + direccional suave. Da
            relieve sin HDRI externo (robusto offline/build). Se atenúa si el doc trae luces. */}
        <hemisphereLight args={['#eef1f4', '#b8b0a4', hasDocLights ? 0.3 : 0.9]} />
        <ambientLight intensity={hasDocLights ? 0.12 : 0.6} />
        <directionalLight position={[10, 15, 8]} intensity={hasDocLights ? 0.3 : 1.1} />
        <LightsLayer items={scene.lights} />
        <RoomMesh scene={scene} onPickWall={onPickWall} />
        <GlassLayer panes={scene.glassPanes} />
        <OpeningFramesLayer frames={scene.openingFrames} />
        <Suspense fallback={null}>
          <FurnitureLayer
            items={scene.furniture}
            selectedId={selectedId ?? null}
            onSelect={onSelect ?? (() => {})}
            onDeselect={onDeselect ?? (() => {})}
            mode={mode ?? 'none'}
            onSetMode={onSetMode ?? (() => {})}
          />
        </Suspense>
        {/* Gizmo de transformación (F2): monta cuando hay modo activo. OrbitControls ya
            tiene makeDefault → TransformControls lo silencia automáticamente al arrastrar. */}
        {selectedId && mode && mode !== 'none' ? (
          <TransformGizmo
            selectedId={selectedId}
            mode={mode}
            scene={{ planCenterPx: scene.planCenterPx, pxPerMeter: scene.pxPerMeter }}
          />
        ) : null}
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
        <CaptureRig order={captureOrder} />
      </Canvas>
    </div>
  );
}
