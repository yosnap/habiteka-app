'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SceneLightingPreset } from './scene-lighting';

/** Neutral local reflections make glass, metal and glazed ceramics legible without a remote HDRI. */
export function SceneEnvironment({ preset }: { preset: SceneLightingPreset }) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room);
    const previous = scene.environment;
    // Three.js owns this mutable scene; the change is confined to the effect lifecycle.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = target.texture;
    invalidate();
    return () => {
      scene.environment = previous;
      target.dispose();
      room.dispose();
      generator.dispose();
      invalidate();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    const previous = scene.environmentIntensity;
    // eslint-disable-next-line react-hooks/immutability
    scene.environmentIntensity = preset === 'evening' ? .15 : preset === 'warm' ? .2 : .24;
    invalidate();
    return () => { scene.environmentIntensity = previous; invalidate(); };
  }, [preset, scene, invalidate]);

  return null;
}
