'use client';

/**
 * Líneas de guía de alineación 3D. Se renderizan en el espacio del mundo como
 * planos finos translúcidos cyan. El contenido se actualiza cada frame via
 * `useFrame` leyendo un `snapGuideRef` compartido con la capa de muebles,
 * sin disparar re-renders de React.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { SnapGuideData } from './furniture-layer';

const GUIDE_LEN = 80;

export function SnapGuideLayer({
  snapGuideRef,
  ceilingH,
}: {
  snapGuideRef: React.RefObject<SnapGuideData>;
  ceilingH: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xMeshRef = useRef<Mesh | null>(null) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zMeshRef = useRef<Mesh | null>(null) as any;

  useFrame(() => {
    const xm = xMeshRef.current as Mesh | null;
    const zm = zMeshRef.current as Mesh | null;
    if (!xm || !zm) return;
    const guide = snapGuideRef.current;
    if (!guide) { xm.visible = false; zm.visible = false; return; }
    if (guide.alignX !== undefined) {
      xm.visible = true;
      xm.position.set(guide.alignX, ceilingH / 2, 0);
    } else {
      xm.visible = false;
    }
    if (guide.alignZ !== undefined) {
      zm.visible = true;
      zm.position.set(0, ceilingH / 2, guide.alignZ);
    } else {
      zm.visible = false;
    }
  });

  return (
    <>
      <mesh ref={xMeshRef} visible={false} raycast={() => null}>
        <boxGeometry args={[0.015, ceilingH, GUIDE_LEN]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} />
      </mesh>
      <mesh ref={zMeshRef} visible={false} raycast={() => null}>
        <boxGeometry args={[GUIDE_LEN, ceilingH, 0.015]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} />
      </mesh>
    </>
  );
}
