'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { buildingWalkNavigation, moveBuildingWalk } from '@/lib/editor-document/building-free-walk';
import { EYE_HEIGHT_MM } from '@/lib/editor-document/room-interior-cameras';
import type { FreeWalkController } from './free-walk-controller';
import { LOOK_RADIANS_PER_PIXEL, walkDelta, walkPitch } from './free-walk-input';

const WALK_SPEED_MM_S = 1600;

export function FreeWalkCamera({ document: plan, start, focus, paused, controller, onPause }: {
  document: EditorDocument;
  start: Point;
  focus: [number, number, number];
  paused: boolean;
  controller: FreeWalkController;
  onPause: () => void;
}) {
  const building = useMemo(() => buildingWalkNavigation(plan), [plan]);
  const initialLevelId = plan.activeLevelId ?? 'ground';
  const elevation = useCallback((levelId: string) => building.levels.find((level) => level.id === levelId)?.elevationMm ?? 0, [building]);
  const { get, invalidate, gl } = useThree();
  const keys = useRef(new Set<string>());
  const position = useRef({ levelId: initialLevelId, point: start });
  const yaw = useRef(Math.atan2(focus[0] - start.x / 1000, focus[2] - start.y / 1000));
  const pitch = useRef(0);
  const lastPoseUpdate = useRef(0);

  useEffect(() => {
    const { camera, controls } = get();
    const orbit = controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
    const previous = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      target: orbit?.target.clone(), fov: camera instanceof PerspectiveCamera ? camera.fov : null };
    position.current = { levelId: initialLevelId, point: start };
    controller.setPose({ ...start, yaw: yaw.current, levelId: initialLevelId });
    camera.position.set(start.x / 1000,
      (elevation(initialLevelId) + (building.navs.get(initialLevelId)?.floorAt(start) ?? 0) + EYE_HEIGHT_MM) / 1000,
      start.y / 1000);
    if (camera instanceof PerspectiveCamera) { camera.fov = 75; camera.updateProjectionMatrix(); }
    camera.lookAt(focus[0], camera.position.y, focus[2]);
    invalidate();
    const down = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
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
  }, [start, focus, initialLevelId, building, elevation, get, invalidate, gl, controller, onPause]);

  useEffect(() => { if (!paused) invalidate(); else { keys.current.clear(); controller.stop(); } }, [paused, invalidate, controller]);
  useFrame(({ camera, clock }, delta) => {
    if (paused) return;
    const control = controller.take();
    const forward = Number(keys.current.has('KeyW') || keys.current.has('ArrowUp'))
      - Number(keys.current.has('KeyS') || keys.current.has('ArrowDown')) + control.forward;
    const strafe = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight'))
      - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft')) + control.strafe;
    yaw.current -= control.lookX * LOOK_RADIANS_PER_PIXEL;
    const lookVertical = Number(keys.current.has('KeyR')) - Number(keys.current.has('KeyF'));
    pitch.current = walkPitch(pitch.current, control.lookY, lookVertical, Math.min(delta, .05));
    const scale = WALK_SPEED_MM_S * Math.min(delta, .05) / Math.max(1, Math.hypot(forward, strafe));
    position.current = moveBuildingWalk(building, position.current, walkDelta(yaw.current, forward, strafe, scale));
    const { levelId, point } = position.current;
    camera.position.set(point.x / 1000,
      (elevation(levelId) + (building.navs.get(levelId)?.floorAt(point) ?? 0) + EYE_HEIGHT_MM) / 1000,
      point.y / 1000);
    camera.lookAt(camera.position.x + Math.sin(yaw.current) * Math.cos(pitch.current),
      camera.position.y + Math.sin(pitch.current),
      camera.position.z + Math.cos(yaw.current) * Math.cos(pitch.current));
    if (clock.elapsedTime - lastPoseUpdate.current >= .1) {
      controller.setPose({ ...point, yaw: yaw.current, levelId });
      lastPoseUpdate.current = clock.elapsedTime;
    }
    invalidate();
  });
  return null;
}
