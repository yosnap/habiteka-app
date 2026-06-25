'use client';

/**
 * Carpintería de los huecos: marco + travesaño de las ventanas y hoja de las puertas.
 * Es lo que hace que un hueco se vea como una VENTANA/PUERTA y no como un agujero. Cada
 * `OpeningFrame` viene posicionado en metros por `docToScene` (lógica pura).
 *
 * Piezas opacas (sólidas), coloreadas por `material`: carpintería clara para ventanas,
 * madera para hojas de puerta. Siguen el MISMO recorte por cámara que los muros, para no
 * quedar flotando cuando se oculta el muro frontal al orbitar.
 */
import { type OpeningFrame } from '@/canvas/3d/doc-to-scene';

/** Color por tipo de carpintería. */
const FRAME_COLOR: Record<OpeningFrame['material'], string> = {
  frame: '#e8e4dc', // carpintería clara (PVC/aluminio lacado)
  door: '#7a5230', // hoja de madera
};

export function OpeningFramesLayer({ frames }: { frames: OpeningFrame[] }) {
  return (
    <group>
      {frames.map((f) => (
        <mesh
          key={f.id}
          position={f.center}
          rotation={[0, f.rotationY, 0]}
          userData={{ openingId: f.id.split(':')[0] }}
        >
          <boxGeometry args={f.size} />
          <meshStandardMaterial color={FRAME_COLOR[f.material]} />
        </mesh>
      ))}
    </group>
  );
}
