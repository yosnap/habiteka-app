'use client';

/**
 * Capa 3D de elementos anclados a la superficie de un muro (enchufes, interruptores,
 * TV de pared, cuadros, radiadores, apliques). `docToScene` ya los posiciona sobre el
 * muro más cercano a su altura de instalación y los orienta; aquí solo se dibujan como
 * cajas coloreadas (placeholder) — sin glTF propio por ahora.
 *
 * art_frame: si el StructObj tiene meta.imageUrl (data URL), se carga como textura del
 * cuadro en vez del color placeholder.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { Suspense } from 'react';
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

/** Carga una textura desde data URL (para art_frame con imagen subida). */
function ArtFrameMesh({ item, imageUrl }: { item: WallSurfaceItem; imageUrl: string }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  return (
    <mesh
      position={item.center}
      rotation={[0, item.rotationY, 0]}
      userData={{ isWallSurface: true, id: item.id }}
    >
      <boxGeometry args={item.size} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

export function WallSurfaceLayer({ items }: { items: WallSurfaceItem[] }) {
  if (items.length === 0) return null;
  return (
    <group>
      {items.map((it) => {
        const imageUrl = it.imageUrl;
        if (it.kind === 'art_frame' && imageUrl) {
          return (
            <Suspense key={it.id} fallback={null}>
              <ArtFrameMesh item={it} imageUrl={imageUrl} />
            </Suspense>
          );
        }
        return (
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
        );
      })}
    </group>
  );
}
