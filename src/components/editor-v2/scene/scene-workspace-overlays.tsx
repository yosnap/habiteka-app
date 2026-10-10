'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { SCENE_STYLES, sceneLength, type SceneOptions } from '../workspace/scene-options-state';

/** Ayudas de trabajo excluidas de las capturas de referencia y de los recorridos. */
export function SceneWorkspaceOverlays({
  document,
  options,
  elevationMm,
  disabled,
}: {
  document: EditorDocument;
  options: SceneOptions;
  elevationMm: number;
  disabled: boolean;
}) {
  const rooms = useMemo(() => roomInteriorCameras(document), [document]);
  const vertices = document.vertices;
  if (disabled || !vertices.length) return null;
  const xs = vertices.map((p) => p.x),
    zs = vertices.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const x = (minX + maxX) / 2000,
    z = (minZ + maxZ) / 2000,
    y = elevationMm / 1000;
  const step = options.gridStep * (options.units === 'imperial' ? 0.3048 : 1);
  const divisions = Math.min(400, Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 1000 / step) + 8);
  const badge = {
    background: '#fffffff0',
    color: '#29413c',
    borderRadius: 20,
    padding: '4px 9px',
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  };
  return (
    <group>
      {options.grid && (
        <gridHelper
          args={[divisions * step, divisions, '#78908a', '#b9c8c3']}
          position={[x, y + 0.015, z]}
          raycast={() => undefined}
        />
      )}
      {options.names &&
        rooms.map((room, index) => (
          <Html
            key={room.roomId}
            zIndexRange={[1, 0]}
            position={[room.camera.position[0], y + 0.12, room.camera.position[2]]}
            center
            style={badge}
          >
            {room.name || `Estancia ${index + 1}`}
          </Html>
        ))}
      {options.dimensions && (
        <>
          <Html
            zIndexRange={[1, 0]}
            position={[x, y + 0.05, minZ / 1000 - 0.6]}
            center
            style={badge}
          >
            {sceneLength(maxX - minX, options.units)}
          </Html>
          <Html
            zIndexRange={[1, 0]}
            position={[maxX / 1000 + 0.6, y + 0.05, z]}
            center
            style={badge}
          >
            {sceneLength(maxZ - minZ, options.units)}
          </Html>
        </>
      )}
    </group>
  );
}

export function SceneWorkspaceStyle({
  style,
  disabled,
}: {
  style: SceneOptions['style'];
  disabled: boolean;
}) {
  const { scene, gl, invalidate } = useThree();
  const palette = SCENE_STYLES[style];
  const background = useMemo(() => new Color(palette.background), [palette]);
  useLayoutEffect(() => {
    if (disabled || style === 'studio') return;
    const original = { background: scene.background, exposure: gl.toneMappingExposure };
    invalidate();
    return () => {
      scene.background = original.background;
      gl.toneMappingExposure = original.exposure;
      invalidate();
    };
  }, [scene, gl, style, disabled, invalidate]);
  useFrame(({ scene: frameScene, gl: renderer }) => {
    if (disabled || style === 'studio') return;
    frameScene.background = background;
    renderer.toneMappingExposure = palette.exposure;
  }, -5);
  return !disabled && style !== 'studio' ? (
    <hemisphereLight args={[palette.sky, palette.ground, 0.65]} />
  ) : null;
}
