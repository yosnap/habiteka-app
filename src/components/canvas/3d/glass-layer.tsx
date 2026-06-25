'use client';

/**
 * Cristales de las ventanas en los huecos abiertos de los muros (parte del render de huecos
 * reales). Cada `GlassPane` viene ya posicionado en metros por `docToScene` (lógica pura).
 *
 * Material translúcido BARATO (`meshStandardMaterial transparent`), sin transmisión/refracción
 * (caras). `depthWrite=false` + `DoubleSide` desde el inicio: el cristal es coplanar al grosor
 * del muro, sin ellos hay z-fighting garantizado. Sigue el MISMO recorte por cámara que los
 * muros (un cristal no debe quedar flotando cuando se oculta el muro frontal al orbitar).
 */
import { DoubleSide } from 'three';
import { type GlassPane } from '@/canvas/3d/doc-to-scene';

export function GlassLayer({ panes }: { panes: GlassPane[] }) {
  return (
    <group>
      {panes.map((p) => (
        <mesh
          key={p.id}
          position={p.center}
          rotation={[0, p.rotationY, 0]}
          userData={{ openingId: p.id.split(':')[0] }}
        >
          <boxGeometry args={p.size} />
          <meshStandardMaterial
            color="#bcd4e6"
            transparent
            opacity={0.25}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
