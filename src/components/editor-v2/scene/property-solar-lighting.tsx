'use client';
import { useMemo } from 'react';
import { Object3D } from 'three';
import type { LightingPreset } from '@/lib/lighting-preset';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { propertyNorth, propertySun, sunDirection } from '@/lib/editor-document/property-orientation';

/** La fuente y su objetivo se trasladan juntos: cambiar la posición de la casa no cambia el rumbo del sol. */
export function propertyLightFrame(document: EditorDocument) {
  const points = [...document.vertices, ...document.furniture.flatMap(item => [item, { x: item.x + item.widthMm, y: item.y + item.depthMm }]),
    ...(document.terrainSurfaces ?? []).flatMap(item => [item, { x: item.x + item.widthMm, y: item.y + item.depthMm }])];
  const xs = points.length ? points.map(point => point.x / 1000) : [0], zs = points.length ? points.map(point => point.y / 1000) : [0];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const buildingHeight = (document.levels ?? []).reduce((sum, level) => sum + level.heightMm / 1000, 0);
  const radius = Math.max(20, Math.hypot(maxX - minX, maxZ - minZ) * .6, buildingHeight * 1.5);
  return { center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2] as [number, number, number], radius, distance: radius * 3 };
}
const AMBIENTS = {
  daylight: { background: '#eeede8', sky: '#ffffff', ground: '#a9aaa0', ambient: .55, color: '#ffffff', intensity: 1.15, shadow: .8 },
  afternoon: { background: '#eeeae1', sky: '#fff3df', ground: '#969080', ambient: .65, color: '#fff0da', intensity: 1.25, shadow: .75 },
  warm: { background: '#eee7dd', sky: '#ffe8c1', ground: '#79685a', ambient: .9, color: '#ffd09b', intensity: 1.5, shadow: .7 },
};
export function PropertySolarLighting({ document, preset }: { document: EditorDocument; preset: LightingPreset }) {
  const north = propertyNorth(document) ?? 0, sun = propertySun(document, preset);
  const frame = useMemo(() => propertyLightFrame(document), [document]);
  const target = useMemo(() => {
    const value = new Object3D(); value.position.set(...frame.center); return value;
  }, [frame]);
  if (!sun || preset === 'evening') return <>
    <color attach="background" args={['#18232d']} />
    <hemisphereLight args={['#7699bd', '#101820', .55]} />
  </>;
  const direction = sunDirection(north, sun), ambient = AMBIENTS[preset];
  const position = direction.map((value, index) => frame.center[index]! + value * frame.distance) as [number, number, number];
  const fill: [number, number, number] = [frame.center[0] - direction[0] * frame.distance, frame.distance / 2, frame.center[2] - direction[2] * frame.distance];
  return <>
    <primitive object={target} />
    <color attach="background" args={[ambient.background]} />
    <hemisphereLight args={[ambient.sky, ambient.ground, ambient.ambient]} />
    <directionalLight position={position} target={target} intensity={ambient.intensity} color={ambient.color} castShadow
      shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={ambient.shadow} shadow-bias={-.0005} shadow-normalBias={.02}
      shadow-camera-left={-frame.radius} shadow-camera-right={frame.radius} shadow-camera-top={frame.radius} shadow-camera-bottom={-frame.radius}
      shadow-camera-near={.5} shadow-camera-far={frame.distance * 2} />
    <directionalLight position={fill} target={target} intensity={preset === 'daylight' ? .16 : .2} color="#d9e8ff" />
  </>;
}
