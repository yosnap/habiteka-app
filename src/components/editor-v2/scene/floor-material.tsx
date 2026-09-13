'use client';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { createFloorPattern } from '../floor-pattern';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { SurfaceMaterial } from './surface-material';

export function FloorMaterial({ finish, textureId = finish.texture, color = finish.color, doubleSide = false }: {
  finish: FloorFinish; textureId?: FloorFinish['texture']; color?: string; doubleSide?: boolean;
}) {
  const texture = useMemo(() => {
    if (surfaceMaterial(textureId)) return null;
    const image = createFloorPattern({ ...finish, texture: textureId, color }); if (!image) return null;
    const result = new CanvasTexture(image); result.colorSpace = SRGBColorSpace;
    result.wrapS = result.wrapT = RepeatWrapping;
    result.repeat.set(1000 / finish.tileSizeMm, 1000 / finish.tileSizeMm);
    result.rotation = finish.rotation * Math.PI / 180;
    return result;
  }, [finish, textureId, color]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return surfaceMaterial(textureId) ? <SurfaceMaterial id={textureId} color={color} tileSizeMm={finish.tileSizeMm} rotation={finish.rotation} doubleSide={doubleSide} />
    : <meshStandardMaterial map={texture} color={texture ? '#ffffff' : color} roughness={.85} side={doubleSide ? 2 : undefined} />;
}
