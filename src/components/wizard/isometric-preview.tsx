'use client';

/**
 * Preview 3D isométrico del resultado del wizard (paso 3).
 * Renderiza la sala y los muebles como cajas coloreadas desde una cámara
 * ortográfica en ángulo isométrico. No carga modelos GLB; es un boceto
 * volumétrico suficiente para dar idea del layout.
 */
import { Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CanvasDoc, StructKind } from '@/canvas/types';

// Colores de familia para las cajas de preview (paleta cálida, como en 2D).
const KIND_COLOR: Partial<Record<StructKind, string>> & { default: string; wall: string; floor: string } = {
  wall:       '#7a6a5e',
  floor:      '#e8dcc8',
  // Sanitarios
  inodoro:    '#cdd5d8',
  lavabo:     '#cdd5d8',
  ducha:      '#9ec7dd',
  banera:     '#cdd5d8',
  bidet:      '#cdd5d8',
  // Cocina
  fregadero:  '#cdd5d8',
  encimera:   '#d8b892',
  nevera:     '#cdd5d8',
  horno:      '#b9bec1',
  isla:       '#d8b892',
  vitroceramica: '#1a1a2a',
  microondas: '#b0b4b8',
  // Mobiliario
  cama:       '#c9b9ad',
  sofa:       '#c9b9ad',
  sofa_grande:'#c9b9ad',
  butaca:     '#c9b9ad',
  mesa:       '#d8b892',
  silla:      '#d8b892',
  armario:    '#d8b892',
  estanteria: '#d8b892',
  mesilla:    '#d8b892',
  // Iluminación
  lampara:    '#fff3d0',
  foco:       '#fff3d0',
  // Decoración
  alfombra:   '#e6ddd0',
  planta:     '#7faa6b',
  default:    '#d8b892',
};

function kindColor(kind: string): string {
  return (KIND_COLOR as Record<string, string>)[kind] ?? KIND_COLOR.default;
}

interface DocBox {
  x: number; // metros
  z: number; // metros (y del plano 2D)
  w: number; // ancho metros
  d: number; // profundidad metros
  h: number; // altura metros
  color: string;
  isWall: boolean;
}

function buildBoxes(doc: CanvasDoc, ceilingH: number): { boxes: DocBox[]; roomW: number; roomD: number } {
  const ppm = doc.scale?.pxPerMeter ?? 100;
  const boxes: DocBox[] = [];
  let maxX = 0;
  let maxZ = 0;

  for (const obj of doc.objects) {
    const xm = obj.x / ppm;
    const zm = obj.y / ppm;
    const wm = obj.width / ppm;
    const dm = obj.height / ppm;
    const isWall = obj.kind === 'wall';
    maxX = Math.max(maxX, xm + wm);
    maxZ = Math.max(maxZ, zm + dm);
    boxes.push({
      x: xm + wm / 2,
      z: zm + dm / 2,
      w: wm,
      d: dm,
      h: isWall ? ceilingH : Math.min(1.0, Math.max(0.4, dm * 0.6)),
      color: kindColor(obj.kind),
      isWall,
    });
  }

  return { boxes, roomW: maxX, roomD: maxZ };
}

/** Configura la cámara ortográfica con lookAt imperativo para vista isométrica. */
function IsoCamera({ cx, cz, span }: { cx: number; cz: number; span: number }) {
  const { camera, gl } = useThree();
  const camRef = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    const s = span || 1;
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(cx + s * 1.2, s * 1.0, cz + s * 1.2);
    cam.near = -200;
    cam.far = 400;
    cam.up.set(0, 1, 0);
    cam.lookAt(cx, 0, cz);
    // Frustum en unidades de mundo (metros), no en píxeles.
    // 0.65 * span metros en la mitad del frustum vertical: la sala isométrica
    // ocupa ~70% del área del preview considerando ángulo y techo.
    const { width, height } = gl.domElement;
    const aspect = width / height;
    const viewHalf = s * 0.65;
    cam.left   = -viewHalf * aspect;
    cam.right  =  viewHalf * aspect;
    cam.top    =  viewHalf;
    cam.bottom = -viewHalf;
    cam.zoom   = 1;
    cam.updateProjectionMatrix();
    camRef.current = cam;
  }, [camera, cx, cz, span, gl]);

  return null;
}

function IsoScene({ doc, ceilingH }: { doc: CanvasDoc; ceilingH: number }) {
  const { boxes, roomW, roomD } = useMemo(() => buildBoxes(doc, ceilingH), [doc, ceilingH]);
  const cx = roomW / 2;
  const cz = roomD / 2;
  const span = Math.max(roomW, roomD, 1);

  return (
    <>
      {/* Luz ambiental + direccional desde el cuadrante de la cámara */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[span * 1.5, span * 2, span * 1.5]} intensity={0.9} />

      {/* Suelo */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomW || 1, roomD || 1]} />
        <meshLambertMaterial color={KIND_COLOR.floor} />
      </mesh>

      {/* Muebles y muros como cajas coloreadas */}
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[Math.max(b.w, 0.01), b.h, Math.max(b.d, 0.01)]} />
          <meshLambertMaterial color={b.color} />
        </mesh>
      ))}

      {/* Cámara ortográfica con lookAt al centro de la sala */}
      <IsoCamera cx={cx} cz={cz} span={span} />
    </>
  );
}

interface Props {
  doc: CanvasDoc;
  ceilingH: number;
  className?: string;
}

export function IsometricPreview({ doc, ceilingH, className }: Props) {
  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas
        orthographic
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#f4f0ea', borderRadius: 8 }}
      >
        <Suspense fallback={null}>
          <IsoScene doc={doc} ceilingH={ceilingH} />
        </Suspense>
      </Canvas>
    </div>
  );
}
