'use client';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Color, DoubleSide, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import { surfaceMaterial, surfaceMaterialAppearance } from '@/lib/editor-document/surface-materials';

interface Props { id?: string; color: string; attach?: string; width?: number; height?: number; offsetX?: number; offsetY?: number; tileSizeMm?: number; rotation?: number; doubleSide?: boolean }
class TextureBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function LoadedMaterial({ id, color, attach, width = 1, height = 1, offsetX = 0, offsetY = 0, tileSizeMm, rotation = 0, doubleSide }: Props) {
  const asset = surfaceMaterial(id)!;
  const appearance = surfaceMaterialAppearance(id);
  const originals = useTexture(appearance
    ? [asset.maps.normal, asset.maps.roughness]
    : [asset.maps.color, asset.maps.normal, asset.maps.roughness]);
  const anisotropy = useThree((state) => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const textures = useMemo(() => originals.map((original, index) => {
    const texture = original.clone();
    const sizeX = (tileSizeMm ?? asset.sizeMm[0]!) / 1000;
    const sizeY = sizeX * asset.sizeMm[1]! / asset.sizeMm[0]!;
    texture.colorSpace = !appearance && index === 0 ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.repeat.set(width / sizeX, height / sizeY);
    texture.offset.set(offsetX / sizeX, offsetY / sizeY);
    texture.rotation = rotation * Math.PI / 180;
    texture.needsUpdate = true;
    return texture;
  }), [originals, appearance, asset, width, height, offsetX, offsetY, tileSizeMm, rotation, anisotropy]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  const baseColor = appearance ? new Color(color).multiply(new Color(appearance.baseColor)) : color;
  return <meshStandardMaterial attach={attach} color={baseColor} map={appearance ? undefined : textures[0]}
    normalMap={textures[appearance ? 0 : 1]} roughnessMap={textures[appearance ? 1 : 2]}
    roughness={1} normalScale={[.55, .55]} side={doubleSide ? DoubleSide : undefined} />;
}
export function SurfaceMaterial(props: Props) {
  const fallback = <meshStandardMaterial attach={props.attach} color={props.color} roughness={.85} side={props.doubleSide ? DoubleSide : undefined} />;
  if (!surfaceMaterial(props.id)) return fallback;
  return <TextureBoundary key={props.id} fallback={fallback}><Suspense fallback={fallback}><LoadedMaterial {...props} /></Suspense></TextureBoundary>;
}
