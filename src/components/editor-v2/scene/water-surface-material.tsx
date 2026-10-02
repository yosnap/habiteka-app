'use client';

import { useEffect, useMemo } from 'react';
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, Vector2 } from 'three';

const MAP_SIZE = 64;
const NORMAL_SCALE = new Vector2(.14, .14);

/** Ondas suaves y periódicas: la misma superficie se ve igual en plano, 3D, visita y captura. */
function waterNormalMap(width: number, depth: number): DataTexture {
  const data = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const u = x / MAP_SIZE, v = y / MAP_SIZE;
    const a = 2 * Math.PI * (2 * u + v), b = 2 * Math.PI * (u - 3 * v);
    const dx = .14 * Math.cos(a) + .06 * Math.cos(b);
    const dy = .07 * Math.cos(a) - .18 * Math.cos(b);
    const length = Math.hypot(dx, dy, 1), index = (y * MAP_SIZE + x) * 4;
    data[index] = Math.round(127.5 * (1 - dx / length));
    data[index + 1] = Math.round(127.5 * (1 - dy / length));
    data[index + 2] = Math.round(127.5 * (1 + 1 / length));
    data[index + 3] = 255;
  }
  const map = new DataTexture(data, MAP_SIZE, MAP_SIZE);
  map.colorSpace = NoColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.repeat.set(Math.max(1, width / 1.4), Math.max(1, depth / 1.4));
  map.needsUpdate = true;
  return map;
}

export function WaterSurfaceMaterial({ color, width, depth }: { color: string; width: number; depth: number }) {
  const normalMap = useMemo(() => waterNormalMap(width, depth), [width, depth]);
  useEffect(() => () => normalMap.dispose(), [normalMap]);
  return <meshPhysicalMaterial color={color} roughness={.24} metalness={0} ior={1.33}
    clearcoat={.3} clearcoatRoughness={.28} normalMap={normalMap} normalScale={NORMAL_SCALE}
    envMapIntensity={.95} />;
}
