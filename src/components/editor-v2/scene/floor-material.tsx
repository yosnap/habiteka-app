'use client';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { createFloorPattern } from '../floor-pattern';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { SurfaceMaterial } from './surface-material';

export function FloorMaterial({ finish, textureId = finish.texture, color = finish.color, doubleSide = false, attach, width, height }: {
  finish: FloorFinish; textureId?: FloorFinish['texture']; color?: string; doubleSide?: boolean; attach?: string;
  width?: number; height?: number;
}) {
  const texture = useMemo(() => {
    if (surfaceMaterial(textureId)) return null;
    const image = createFloorPattern({ ...finish, texture: textureId, color }); if (!image) return null;
    const result = new CanvasTexture(image); result.colorSpace = SRGBColorSpace;
    result.wrapS = result.wrapT = RepeatWrapping;
    result.repeat.set((width ?? 1) * 1000 / finish.tileSizeMm, (height ?? 1) * 1000 / finish.tileSizeMm);
    result.rotation = finish.rotation * Math.PI / 180;
    return result;
  }, [finish, textureId, color, width, height]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return surfaceMaterial(textureId) ? <SurfaceMaterial attach={attach} id={textureId} color={color} tileSizeMm={finish.tileSizeMm}
    width={width} height={height} rotation={finish.rotation} doubleSide={doubleSide} />
    : <meshStandardMaterial attach={attach} map={texture} color={texture ? '#ffffff' : color} roughness={.85} side={doubleSide ? 2 : undefined} />;
}
