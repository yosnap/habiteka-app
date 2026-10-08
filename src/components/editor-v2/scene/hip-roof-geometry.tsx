'use client';
import { useEffect, useMemo } from 'react';
import { createHipRoofGeometry } from '@/lib/editor-document/hip-roof-mesh';
export { createHipRoofGeometry } from '@/lib/editor-document/hip-roof-mesh';
import type { Vector3Tuple } from '@/canvas/editor-v2/scene/types';

export function HipRoofGeometry({ size }: { size: Vector3Tuple }) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => createHipRoofGeometry(width, height, depth), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}
