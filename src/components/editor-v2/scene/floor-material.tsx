'use client';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { createFloorPattern } from '../floor-pattern';

export function FloorMaterial({ finish }: { finish: FloorFinish }) {
  const texture = useMemo(() => {
    const image = createFloorPattern(finish); if (!image) return null;
    const result = new CanvasTexture(image); result.colorSpace = SRGBColorSpace;
    result.wrapS = result.wrapT = RepeatWrapping;
    result.repeat.set(1000 / finish.tileSizeMm, 1000 / finish.tileSizeMm);
    result.rotation = finish.rotation * Math.PI / 180;
    return result;
  }, [finish]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return <meshStandardMaterial map={texture} color={texture ? '#ffffff' : finish.color} roughness={.85} />;
}
