'use client';

/**
 * Capa de luces de la escena 3D (F6.3). Renderiza cada luz de primera clase (F-LUZ) del
 * doc como una `pointLight` ya posicionada en metros por `docToScene` (color, intensidad
 * física, alcance y atenuación incluidos), más una pequeña ESFERA EMISIVA en la misma
 * posición para que se vea la FUENTE (una pointLight no se ve a sí misma; sin esto solo
 * se aprecia el halo sobre las superficies). Sombras OFF en v1 (ajuste 4 del /ck:predict).
 */
import type { SceneLight } from '@/canvas/3d/doc-to-scene';

/** Radio de la esfera-bombilla que marca la posición del foco (metros). */
const BULB_RADIUS_M = 0.06;

export function LightsLayer({ items }: { items: SceneLight[] }) {
  return (
    <group>
      {items.map((l) => (
        <group key={l.id}>
          <pointLight
            position={l.position}
            color={l.color}
            intensity={l.intensity}
            distance={l.distance}
            decay={l.decay}
          />
          {/* Fuente visible: esfera que "brilla" con el color de la luz (material
              emisivo, no depende de la iluminación de la escena). */}
          <mesh position={l.position}>
            <sphereGeometry args={[BULB_RADIUS_M, 16, 16]} />
            <meshStandardMaterial
              color={l.color}
              emissive={l.color}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
