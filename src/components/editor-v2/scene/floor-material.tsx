'use client';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { createFloorPattern } from '../floor-pattern';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { SurfaceMaterial } from './surface-material';

export function FloorMaterial({ finish }: { finish: FloorFinish }) {
  const texture = useMemo(() => {
    if (surfaceMaterial(finish.texture)) return null;
    const image = createFloorPattern(finish); if (!image) return null;
    const result = new CanvasTexture(image); result.colorSpace = SRGBColorSpace;
    result.wrapS = result.wrapT = RepeatWrapping;
    result.repeat.set(1000 / finish.tileSizeMm, 1000 / finish.tileSizeMm);
    result.rotation = finish.rotation * Math.PI / 180;
    return result;
  }, [finish]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return surfaceMaterial(finish.texture) ? <SurfaceMaterial id={finish.texture} color={finish.color} tileSizeMm={finish.tileSizeMm} rotation={finish.rotation} />
    : <meshStandardMaterial map={texture} color={texture ? '#ffffff' : finish.color} roughness={.85} />;
}
