'use client';

import type { EditorScene } from '@/canvas/editor-v2/scene/types';

/** Recibe sombras bajo la escena sin crear suelo transitable en el documento. */
export function SceneGround({ scene, elevationMm = 0 }: { scene: EditorScene; elevationMm?: number }) {
  const base = Math.min(0,
    ...scene.polygons.map((polygon) => polygon.elevation),
    ...scene.boxes.map((box) => box.position[1] - box.size[1] / 2));
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, elevationMm / 1000 + base - .035, 0]}
    receiveShadow raycast={() => undefined}>
    <planeGeometry args={[200, 200]} />
    <shadowMaterial color="#4e554d" opacity={.28} depthWrite={false} />
  </mesh>;
}
