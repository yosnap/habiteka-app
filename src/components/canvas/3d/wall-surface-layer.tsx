'use client';

/**
 * Capa 3D de elementos anclados a la superficie de un muro (enchufes, interruptores,
 * TV de pared, cuadros, radiadores, apliques). `docToScene` ya los posiciona sobre el
 * muro más cercano a su altura de instalación y los orienta; aquí solo se dibujan como
 * cajas coloreadas (placeholder) — sin glTF propio por ahora.
 *
 * MVP F2 wall-surface: render correcto anclado al muro. La selección/arrastre sobre la
 * superficie del muro queda como siguiente refinamiento.
 */
import type { WallSurfaceItem } from '@/canvas/3d/doc-to-scene';
import type { WallSurfaceKind } from '@/canvas/types';

/** Color de placeholder por kind (caja). */
function colorFor(kind: WallSurfaceKind): string {
  switch (kind) {
    case 'tv_mount':
      return '#1a1a1f'; // panel oscuro
    case 'art_frame':
      return '#8a6f4a'; // marco madera
    case 'radiator':
      return '#c8ccd0'; // metal claro
    case 'wall_sconce':
      return '#f0e6c8'; // aplique cálido
    default:
      return '#e8ecef'; // enchufe / interruptor / termostato (blanco)
  }
}

export function WallSurfaceLayer({ items }: { items: WallSurfaceItem[] }) {
  if (items.length === 0) return null;
  return (
    <group>
      {items.map((it) => (
        <mesh
          key={it.id}
          position={it.center}
          rotation={[0, it.rotationY, 0]}
          userData={{ isWallSurface: true, id: it.id }}
          castShadow={false}
          receiveShadow={false}
        >
          <boxGeometry args={it.size} />
          <meshStandardMaterial color={it.color ?? colorFor(it.kind)} />
        </mesh>
      ))}
    </group>
  );
}
