'use client';
import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, useBounds } from '@react-three/drei';
export interface CameraRequest { sequence: number; action: 'fit' | 'in' | 'out' }

export function SceneCamera({ request, onContextLost }: { request: CameraRequest; onContextLost: () => void }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null), bounds = useBounds();
  const { camera, invalidate, gl } = useThree();
  // Camera fitting is imperative Three.js state; never writes canonical coordinates.
  useEffect(() => {
    if (request.action === 'fit') bounds.refresh().clip().fit();
    else if (controls.current) {
      const target = controls.current.target;
      camera.position.sub(target).multiplyScalar(request.action === 'in' ? .8 : 1.25).add(target);
      controls.current.update(); invalidate();
    }
  }, [request, bounds, camera, invalidate]);
  // Release the external browser subscription when the 3D view unmounts.
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onContextLost]);
  return <OrbitControls ref={controls} makeDefault enableDamping minDistance={.3} maxDistance={300}
    maxPolarAngle={Math.PI / 2 - .02} />;
}
