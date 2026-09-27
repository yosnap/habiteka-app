'use client';
import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, useBounds } from '@react-three/drei';
import { MOUSE, PerspectiveCamera, Vector3 } from 'three';
import { cameraFitDistance } from './camera-fit';

export type SceneCameraPreset = 'top' | 'isometric' | 'front' | 'back' | 'left' | 'right' | 'drone';
export interface CameraRequest {
  sequence: number;
  action: 'fit' | 'in' | 'out' | 'interior' | SceneCameraPreset;
  /** Caja a encuadrar en lugar de toda la escena (p. ej. la zona permitida). */
  focus?: { center: [number, number, number]; size: [number, number, number] };
  /** Pose exacta para `interior`: ojo dentro de la estancia y punto de mira. */
  pose?: { position: [number, number, number]; focus: [number, number, number]; fovDeg: number };
}

/**
 * Distancia del punto de órbita al ojo cuando se entra en una estancia. Es
 * corta a propósito: el usuario gira mirando alrededor desde donde está, en vez
 * de orbitar la casa desde fuera.
 */
const INTERIOR_ORBIT_M = .6;

const PRESET_DIRECTIONS: Record<SceneCameraPreset, readonly [number, number, number]> = {
  top: [0, 1, .0001],
  isometric: [1, 1, 1],
  front: [0, .65, 1],
  back: [0, .65, -1],
  left: [-1, .65, 0],
  right: [1, .65, 0],
  drone: [.35, 1.35, 1],
};

export function SceneCamera({ request, sceneVersion, interior = false, enabled = true, plan = false, onManualChange, onContextLost, onApplied }: {
  request: CameraRequest;
  sceneVersion: unknown;
  /** Dentro de una estancia: se puede mirar al techo y no se reencuadra sola. */
  interior?: boolean;
  enabled?: boolean;
  plan?: boolean;
  onManualChange: () => void;
  onContextLost: () => void;
  onApplied?: (sequence: number) => void;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null), bounds = useBounds();
  const lastSequence = useRef<number | null>(null);
  const lastAction = useRef<CameraRequest['action'] | null>(null);
  // Campo de visión de fuera, guardado al entrar en una estancia para devolverlo al salir.
  const exteriorFov = useRef<number | null>(null);
  const { get, invalidate, gl, size } = useThree();
  // Camera fitting is imperative Three.js state; never writes canonical coordinates.
  useEffect(() => {
    const camera = get().camera;
    const orbit = controls.current;
    if (!orbit || !(camera instanceof PerspectiveCamera)) return;
    const isNewRequest = lastSequence.current !== request.sequence;
    // En el plano cenital una edición no debe deshacer el zoom ni el desplazamiento elegidos por el usuario.
    if (plan && !isNewRequest) return;
    lastSequence.current = request.sequence;
    // Un cambio de escena reencuadra la vista, salvo estando dentro de una
    // estancia: ahí el usuario perdería su punto de vista sin haberlo pedido.
    if (!isNewRequest && lastAction.current === 'interior') return;
    const action = isNewRequest ? request.action : lastAction.current === 'top' ? 'top' : 'fit';
    lastAction.current = action;
    if (action === 'interior' && request.pose) {
      const { position, focus: aim, fovDeg } = request.pose;
      exteriorFov.current ??= camera.fov;
      camera.position.set(...position);
      camera.fov = fovDeg;
      camera.near = .01;
      camera.far = Math.max(500, camera.far);
      // El objetivo de órbita se queda justo delante del ojo: girar es mirar alrededor.
      const direction = new Vector3(...aim).sub(camera.position);
      if (!direction.lengthSq()) direction.set(0, 0, -1);
      orbit.target.copy(camera.position).addScaledVector(direction.normalize(), INTERIOR_ORBIT_M);
      camera.updateProjectionMatrix();
    } else if (action === 'in' || action === 'out') {
      const distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance,
        camera.position.distanceTo(orbit.target) * (action === 'in' ? .8 : 1.25)));
      camera.position.sub(orbit.target).setLength(distance).add(orbit.target);
    } else {
      if (exteriorFov.current !== null) { camera.fov = exteriorFov.current; exteriorFov.current = null; }
      // Bounds only measures geometry. A single controller owns the camera,
      // avoiding a pending Bounds animation overwriting a preset on the next frame.
      const focus = isNewRequest ? request.focus : undefined;
      const { center, size: extent } = focus
        ? { center: new Vector3(...focus.center), size: new Vector3(...focus.size) }
        : bounds.refresh().getSize();
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
  }, [request, bounds, get, invalidate, size.width, size.height, sceneVersion, onApplied, plan]);
  // Release the external browser subscription when the 3D view unmounts.
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onContextLost]);
  return <OrbitControls ref={controls} makeDefault enabled={enabled} enableDamping={false} minDistance={.3}
    enableRotate={!plan} mouseButtons={plan ? { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN } : undefined}
    onStart={onManualChange} maxPolarAngle={interior ? Math.PI : Math.PI / 2} />;
}
