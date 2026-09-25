'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { moveFreeWalk } from '@/lib/editor-document/free-walk-navigation';
import { EYE_HEIGHT_MM } from '@/lib/editor-document/room-interior-cameras';
import type { FreeWalkController } from './free-walk-controller';

const WALK_SPEED_MM_S = 1600;
const LOOK_RADIANS_PER_PIXEL = .0025;

export function FreeWalkCamera({ document: plan, start, focus, elevationMm, paused, controller, onPause }: {
  document: EditorDocument;
  start: Point;
  focus: [number, number, number];
  elevationMm: number;
  paused: boolean;
  controller: FreeWalkController;
  onPause: () => void;
}) {
  const nav = useMemo(() => walkthroughNavigation(plan), [plan]);
  const { get, invalidate, gl } = useThree();
  const keys = useRef(new Set<string>());
  const position = useRef(start);
  const yaw = useRef(Math.atan2(focus[0] - start.x / 1000, focus[2] - start.y / 1000));
  const pitch = useRef(0);
  const lastPoseUpdate = useRef(0);

  useEffect(() => {
    const { camera, controls } = get();
    const orbit = controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
    const previous = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      target: orbit?.target.clone(), fov: camera instanceof PerspectiveCamera ? camera.fov : null };
    position.current = start;
    controller.setPose({ ...start, yaw: yaw.current });
    camera.position.set(start.x / 1000, (elevationMm + nav.floorAt(start) + EYE_HEIGHT_MM) / 1000, start.y / 1000);
    if (camera instanceof PerspectiveCamera) { camera.fov = 75; camera.updateProjectionMatrix(); }
    camera.lookAt(focus[0], camera.position.y, focus[2]);
    invalidate();
    const down = (event: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault(); keys.current.add(event.code);
      }
      if (event.code === 'Escape') onPause();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const mouse = (event: MouseEvent) => {
      if (window.document.pointerLockElement === gl.domElement || (event.buttons === 1 && event.target === gl.domElement)) {
        controller.look(event.movementX, event.movementY);
      }
    };
    const lockChange = () => { if (window.document.pointerLockElement !== gl.domElement) onPause(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.document.addEventListener('mousemove', mouse);
    window.document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.document.removeEventListener('mousemove', mouse);
      window.document.removeEventListener('pointerlockchange', lockChange);
      if (window.document.pointerLockElement === gl.domElement) window.document.exitPointerLock();
      camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion);
      if (camera instanceof PerspectiveCamera && previous.fov !== null) { camera.fov = previous.fov; camera.updateProjectionMatrix(); }
      if (orbit && previous.target) { orbit.target.copy(previous.target); orbit.update(); }
      controller.setPose(null);
      invalidate();
    };
  }, [start, focus, elevationMm, nav, get, invalidate, gl, controller, onPause]);

  useEffect(() => { if (!paused) invalidate(); else { keys.current.clear(); controller.stop(); } }, [paused, invalidate, controller]);
  useFrame(({ camera, clock }, delta) => {
    if (paused) return;
    const control = controller.take();
    const forward = Number(keys.current.has('KeyW') || keys.current.has('ArrowUp'))
      - Number(keys.current.has('KeyS') || keys.current.has('ArrowDown')) + control.forward;
    const strafe = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight'))
      - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft')) + control.strafe;
    yaw.current -= control.lookX * LOOK_RADIANS_PER_PIXEL;
    pitch.current = Math.max(-1.35, Math.min(1.35, pitch.current - control.lookY * LOOK_RADIANS_PER_PIXEL));
    const scale = WALK_SPEED_MM_S * Math.min(delta, .05) / Math.max(1, Math.hypot(forward, strafe));
    position.current = moveFreeWalk(nav, position.current, {
      x: (Math.sin(yaw.current) * forward + Math.cos(yaw.current) * strafe) * scale,
      y: (Math.cos(yaw.current) * forward - Math.sin(yaw.current) * strafe) * scale,
    });
    camera.position.set(position.current.x / 1000,
      (elevationMm + nav.floorAt(position.current) + EYE_HEIGHT_MM) / 1000, position.current.y / 1000);
    camera.lookAt(camera.position.x + Math.sin(yaw.current) * Math.cos(pitch.current),
      camera.position.y + Math.sin(pitch.current),
      camera.position.z + Math.cos(yaw.current) * Math.cos(pitch.current));
    if (clock.elapsedTime - lastPoseUpdate.current >= .1) {
      controller.setPose({ ...position.current, yaw: yaw.current });
      lastPoseUpdate.current = clock.elapsedTime;
    }
    invalidate();
  });
  return null;
}
