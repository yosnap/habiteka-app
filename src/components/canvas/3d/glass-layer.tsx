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

/** Color y opacidad según el tipo de vidrio. */
function glassVisual(glassType?: string): { color: string; opacity: number } {
  switch (glassType) {
    case 'doble':
      return { color: '#8cb8d8', opacity: 0.35 };
    case 'oscurecido':
      return { color: '#3a3e42', opacity: 0.55 };
    default:
      return { color: '#bcd4e6', opacity: 0.25 };
  }
}

export function GlassLayer({ panes }: { panes: GlassPane[] }) {
  return (
    <group>
      {panes.map((p) => {
        const { color, opacity } = glassVisual(p.glassType);
        return (
          <mesh
            key={p.id}
            position={p.center}
            rotation={[0, p.rotationY, 0]}
            userData={{ openingId: p.id.split(':')[0] }}
          >
            <boxGeometry args={p.size} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
