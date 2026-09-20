'use client';
import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, useBounds } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraFitDistance } from './camera-fit';

export type SceneCameraPreset = 'top' | 'isometric' | 'front' | 'back' | 'left' | 'right' | 'drone';
export interface CameraRequest {
  sequence: number;
  action: 'fit' | 'in' | 'out' | SceneCameraPreset;
}

const PRESET_DIRECTIONS: Record<SceneCameraPreset, readonly [number, number, number]> = {
  top: [0, 1, .0001],
  isometric: [1, 1, 1],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  drone: [1, 2, 1],
};

export function SceneCamera({ request, sceneVersion, onManualChange, onContextLost, onApplied }: {
  request: CameraRequest;
  sceneVersion: unknown;
  onManualChange: () => void;
  onContextLost: () => void;
  onApplied?: (sequence: number) => void;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null), bounds = useBounds();
  const lastSequence = useRef<number | null>(null);
  const { get, invalidate, gl, size } = useThree();
  // Camera fitting is imperative Three.js state; never writes canonical coordinates.
  useEffect(() => {
    const camera = get().camera;
    const orbit = controls.current;
    if (!orbit || !(camera instanceof PerspectiveCamera)) return;
    const isNewRequest = lastSequence.current !== request.sequence;
    lastSequence.current = request.sequence;
    const action = isNewRequest ? request.action : 'fit';
    if (action === 'in' || action === 'out') {
      const distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance,
        camera.position.distanceTo(orbit.target) * (action === 'in' ? .8 : 1.25)));
      camera.position.sub(orbit.target).setLength(distance).add(orbit.target);
    } else {
      // Bounds only measures geometry. A single controller owns the camera,
      // avoiding a pending Bounds animation overwriting a preset on the next frame.
      const { center, size: extent } = bounds.refresh().getSize();
      const direction = action in PRESET_DIRECTIONS
        ? new Vector3(...PRESET_DIRECTIONS[action as SceneCameraPreset]).normalize()
        : camera.position.clone().sub(orbit.target).normalize();
      if (!direction.lengthSq()) direction.set(1, 1, 1).normalize();
      const verticalFov = camera.getEffectiveFOV() * Math.PI / 180;
      const distance = cameraFitDistance(extent, direction, verticalFov, camera.aspect);
      orbit.target.copy(center);
      orbit.maxDistance = Math.max(300, distance * 10);
      camera.near = Math.min(.01, distance / 1000);
      camera.far = Math.max(500, distance * 20);
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(orbit.target);
    orbit.update();
    invalidate();
    onApplied?.(request.sequence);
  }, [request, bounds, get, invalidate, size.width, size.height, sceneVersion, onApplied]);
  // Release the external browser subscription when the 3D view unmounts.
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onContextLost]);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={.3}
    onStart={onManualChange} maxPolarAngle={Math.PI / 2} />;
}
