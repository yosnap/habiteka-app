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
import { Mesh, Shape, type Object3D, type PerspectiveCamera } from 'three';
import type { CanvasDoc } from '@/canvas/types';
import { docToScene, type Scene3D, type WallBox } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl } from '@/canvas/3d/furniture-models';
import { cameraForAngle, type ViewAngle } from '@/canvas/3d/camera-views';
import { useMountEffect } from '@/lib/use-mount-effect';
import type { SelectionMode } from './use-3d-selection';
import { TransformGizmo } from './transform-gizmo';
import { FurnitureLayer, type SnapGuideData } from './furniture-layer';
import { LightsLayer } from './lights-layer';
import { GlassLayer } from './glass-layer';
import { OpeningFramesLayer } from './opening-frames-layer';
import { SnapGuideLayer } from './snap-guide-layer';
import { OpeningInteractionLayer } from './opening-interaction-layer';
import { CeilingLayer } from './ceiling-layer';

/**
 * Muros con recorte por cámara (F6.4): cada frame se oculta el muro que queda entre la
 * cámara y el interior (estilo Planner5D/Sims), para poder ver dentro al orbitar. La
 * decisión es lógica pura (`shouldHideWall`); aquí solo se aplica `visible` por muro.
 */
const DEFAULT_WALL_COLOR = '#b7c3cf';

function Walls({
  walls,
  onPick,
  onSelectOpening,
  pickWallMode,
  onPickForOpening,
}: {
  walls: WallBox[];
  onPick?: (sourceId: string, screenX: number, screenY: number) => void;
  /** Seleccionar puerta/ventana cuando el clic cae sobre su marco. */
  onSelectOpening?: (openingId: string) => void;
  /** Cuando true: clic en muro llama onPickForOpening (modo colocar apertura). */
  pickWallMode?: boolean;
  onPickForOpening?: (wallId: string) => void;
}) {
  const refs = useRef<(Mesh | null)[]>([]);
  const [hoveredPickId, setHoveredPickId] = useState<string | null>(null);
  return (
    <group>
      {walls.map((w, i) => {
        const srcId = w.sourceId ?? w.id;
        const isManuallyHidden = !!w.hidden;
        const isHoveredPick = pickWallMode && hoveredPickId === w.id;
        return (
          <mesh
            key={w.id}
            ref={(m) => { refs.current[i] = m; }}
            position={w.center}
            rotation={[0, w.rotationY, 0]}
            onClick={(e) => {
              // Modo selección de muro para colocar apertura
              if (pickWallMode) {
                e.stopPropagation();
                onPickForOpening?.(srcId);
                return;
              }
              // Si el rayo toca el marco/cristal de una puerta o ventana, seleccionarla.
              if (onSelectOpening) {
                for (const inter of e.intersections) {
                  let obj: Object3D | null = inter.object;
                  while (obj) {
                    if (obj.userData?.openingId) {
                      e.stopPropagation();
                      onSelectOpening(obj.userData.openingId as string);
                      return;
                    }
                    obj = obj.parent;
                  }
                }
              }
              if (!onPick) return;
              // Si hay muebles en el rayo, dejar que el mueble gestione el clic.
              const hasFurniture = e.intersections.some((inter) => {
                let obj: Object3D | null = inter.object;
                while (obj) { if (obj.userData?.isFurniture) return true; obj = obj.parent; }
                return false;
              });
              if (hasFurniture) return;
              e.stopPropagation();
              onPick(srcId, e.nativeEvent.clientX, e.nativeEvent.clientY);
            }}
            onPointerEnter={() => { if (pickWallMode) setHoveredPickId(w.id); }}
            onPointerLeave={() => { if (pickWallMode) setHoveredPickId(null); }}
          >
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color={isHoveredPick ? '#5bc4f5' : (w.color ?? DEFAULT_WALL_COLOR)}
              transparent={isManuallyHidden || isHoveredPick}
              opacity={isManuallyHidden ? 0.13 : isHoveredPick ? 0.65 : 1}
            />
          </mesh>
        );
      })}
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
  onSelectOpening,
  pickWallForOpening,
  onPickWallForOpening,
}: {
  scene: Scene3D;
  onPickWall?: (sourceId: string, screenX: number, screenY: number) => void;
  onSelectOpening?: (openingId: string) => void;
  pickWallForOpening?: boolean;
  onPickWallForOpening?: (wallId: string) => void;
}) {
  return (
    <group>
      <Floor floor={scene.floor} />
      {/* Se pasan TODAS las paredes — las ocultas manualmente se renderizan translúcidas */}
      <Walls
        walls={scene.walls}
        onPick={onPickWall}
        onSelectOpening={onSelectOpening}
        pickWallMode={pickWallForOpening}
        onPickForOpening={onPickWallForOpening}
      />
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
  pickWallForOpening,
  onPickWallForOpening,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
  onSwap,
}: {
  doc: CanvasDoc;
  /** Si se pasa, habilita capturar vistas por ángulo y entregar el data URL al caller. */
  onGenerateView?: (dataUrl: string, angle: ViewAngle) => void;
  /** Clic sobre un muro para menú de color. */
  onPickWall?: (sourceId: string, screenX: number, screenY: number) => void;
  /** Cuando true, los muros se resaltan para que el usuario elija dónde colocar una apertura. */
  pickWallForOpening?: boolean;
  onPickWallForOpening?: (wallId: string) => void;
  /** Selección 3D (F1 editor). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  mode?: SelectionMode;
  onSetMode?: (m: SelectionMode) => void;
  onSwap?: (id: string) => void;
}) {
  // La escena depende solo del doc: memoizar evita recalcular en cada render.
  const scene = useMemo(() => docToScene(doc), [doc]);
  const [stats, setStats] = useState<PerfStats>({ fps: 0, calls: 0, tris: 0 });
  // Referencia compartida para guías de alineación: FurnitureLayer escribe, SnapGuideLayer lee.
  const snapGuideRef = useRef<SnapGuideData>(null);

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
          {scene.walls.length} muros · {scene.furniture.length} muebles ·{' '}
          {scene.ceilingItems.length > 0 ? `${scene.ceilingItems.length} techo · ` : ''}
          {scene.lights.length} luces · suelo {scene.floor.size[0].toFixed(1)}×{scene.floor.size[1].toFixed(1)} m ·{' '}
          {stats.calls} draw calls · {stats.tris.toLocaleString()} tris
        </span>
      </div>
      {/* Barra de captura de vistas (solo si el caller pide vistas). Sobre el Canvas. */}
      {onGenerateView ? (
        <div className="absolute right-3 top-14 z-10 flex gap-1.5">
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
        <RoomMesh
          scene={scene}
          onPickWall={onPickWall}
          onSelectOpening={onSelect}
          pickWallForOpening={pickWallForOpening}
          onPickWallForOpening={onPickWallForOpening}
        />
        <GlassLayer panes={scene.glassPanes} />
        <OpeningFramesLayer frames={scene.openingFrames} />
        <OpeningInteractionLayer
          doc={doc}
          scene={scene}
          selectedId={selectedId ?? null}
          onSelect={onSelect}
          snapGuideRef={snapGuideRef}
        />
        <SnapGuideLayer snapGuideRef={snapGuideRef} ceilingH={scene.ceilingHeightM} />
        <Suspense fallback={null}>
          <FurnitureLayer
            items={scene.furniture}
            selectedId={selectedId ?? null}
            onSelect={onSelect ?? (() => {})}
            onDeselect={onDeselect ?? (() => {})}
            mode={mode ?? 'none'}
            onSetMode={onSetMode ?? (() => {})}
            sceneCoords={scene}
            onSwap={onSwap}
            walls={scene.walls}
            snapGuideRef={snapGuideRef}
          />
        </Suspense>
        <CeilingLayer
          items={scene.ceilingItems}
          ceilingHeightM={scene.ceilingHeightM}
          selectedId={selectedId ?? null}
          onSelect={onSelect ?? (() => {})}
          onDeselect={onDeselect ?? (() => {})}
          mode={mode ?? 'none'}
          onSetMode={onSetMode ?? (() => {})}
        />
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
