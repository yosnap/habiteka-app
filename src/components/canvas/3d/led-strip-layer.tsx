'use client';

/**
 * Cenefa LED perimetral (F3): una línea de luz que sigue el polígono del suelo a la
 * altura del techo. Se activa cuando el doc tiene un objeto `led_strip`. El color y
 * la intensidad provienen de los atributos `light` del objeto (si los tiene) o de un
 * default cálido. Material emisivo para que se vea como una tira LED encendida.
 */
import { useMemo } from 'react';
import * as THREE from 'three';

export function LedStripLayer({
  polygon,
  ceilingHeightM,
  color = '#ffd9a0',
}: {
  polygon: Array<[number, number]> | undefined;
  ceilingHeightM: number;
  color?: string;
}) {
  const points = useMemo(() => {
    if (!polygon || polygon.length < 3) return null;
    // Convertir puntos 2D (X,Z) a 3D: Y = techo - 5cm (pegada al techo).
    const pts = polygon.map(([x, z]) => new THREE.Vector3(x, ceilingHeightM - 0.05, z));
    return pts;
  }, [polygon, ceilingHeightM]);

  if (!points) return null;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    });
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [points]);

  return (
    <lineLoop args={[geometry]}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </lineLoop>
  );
}
