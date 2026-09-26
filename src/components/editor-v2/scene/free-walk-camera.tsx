'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { buildingWalkNavigation, moveBuildingWalk } from '@/lib/editor-document/building-free-walk';
import { EYE_HEIGHT_MM } from '@/lib/editor-document/room-interior-cameras';
import type { FreeWalkController } from './free-walk-controller';
import { LOOK_RADIANS_PER_PIXEL, thirdPersonCameraOffset, walkInputDelta, walkPitch, walkTurn } from './free-walk-input';
import { FreeWalkAvatar } from './free-walk-avatar';

const WALK_SPEED_MM_S = 2200;
const RUN_SPEED_MM_S = 3600;
const MAX_FRAME_SECONDS = .25;

export function FreeWalkCamera({ document: plan, start, focus, paused, viewMode, controller, onPause, onToggleView }: {
  document: EditorDocument;
  start: Point;
  focus: [number, number, number];
  paused: boolean;
  viewMode: 'first' | 'third';
  controller: FreeWalkController;
  onPause: () => void;
  onToggleView: () => void;
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
  const followOffset = useRef<Point>({ x: 0, y: -1200 });
  const lastFollowUpdate = useRef(-Infinity);
  const lastFollowPose = useRef({ x: NaN, y: NaN, yaw: NaN, levelId: '' });
  const avatar = useRef<Group>(null);
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);

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
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault(); keys.current.add(event.code);
      }
      if (event.code === 'KeyV' && !event.repeat) { event.preventDefault(); onToggleView(); }
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
  }, [start, focus, initialLevelId, building, elevation, get, invalidate, gl, controller, onPause, onToggleView]);

  useEffect(() => { if (!paused) invalidate(); else { keys.current.clear(); controller.stop(); } }, [paused, invalidate, controller]);
  useFrame(({ camera, clock }, delta) => {
    if (paused) return;
    const seconds = Math.min(delta, MAX_FRAME_SECONDS);
    const control = controller.take();
    yaw.current = walkTurn(yaw.current, keys.current, control.turn, seconds);
    yaw.current -= control.lookX * LOOK_RADIANS_PER_PIXEL;
    const lookVertical = Number(keys.current.has('KeyR')) - Number(keys.current.has('KeyF'));
    pitch.current = walkPitch(pitch.current, control.lookY, lookVertical, seconds);
    const speed = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight') ? RUN_SPEED_MM_S : WALK_SPEED_MM_S;
    const step = walkInputDelta(yaw.current, keys.current, control, speed * seconds);
    const previousPoint = position.current.point;
    position.current = moveBuildingWalk(building, position.current, step);
    const { levelId, point } = position.current;
    const moving = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > 1;
    if (leftLeg.current && rightLeg.current) {
      const swing = moving ? Math.sin(clock.elapsedTime * 10) * .32 : 0;
      leftLeg.current.rotation.x = swing;
      rightLeg.current.rotation.x = -swing;
    }
    const nav = building.navs.get(levelId), floorY = (elevation(levelId) + (nav?.floorAt(point) ?? 0)) / 1000;
    if (avatar.current) {
      avatar.current.position.set(point.x / 1000, floorY, point.y / 1000);
      avatar.current.rotation.y = yaw.current;
    }
    if (viewMode === 'third') {
      const previous = lastFollowPose.current;
      const followChanged = previous.levelId !== levelId || Math.hypot(point.x - previous.x, point.y - previous.y) > 80 ||
        Math.abs(yaw.current - previous.yaw) > .1;
      if (followChanged && clock.elapsedTime - lastFollowUpdate.current > .12) {
        followOffset.current = thirdPersonCameraOffset((candidate) => nav?.free(candidate) ?? false, point, yaw.current);
        lastFollowUpdate.current = clock.elapsedTime;
        lastFollowPose.current = { ...point, yaw: yaw.current, levelId };
      }
      camera.position.set((point.x + followOffset.current.x) / 1000, floorY + 1.9,
        (point.y + followOffset.current.y) / 1000);
      camera.lookAt(point.x / 1000 + Math.sin(yaw.current) * .4,
        floorY + 1.0 + Math.sin(pitch.current) * 1.4,
        point.y / 1000 + Math.cos(yaw.current) * .4);
    } else {
      camera.position.set(point.x / 1000, floorY + EYE_HEIGHT_MM / 1000, point.y / 1000);
      camera.lookAt(camera.position.x + Math.sin(yaw.current) * Math.cos(pitch.current),
        camera.position.y + Math.sin(pitch.current),
        camera.position.z + Math.cos(yaw.current) * Math.cos(pitch.current));
    }
    if (clock.elapsedTime - lastPoseUpdate.current >= .1) {
      controller.setPose({ ...point, yaw: yaw.current, levelId });
      lastPoseUpdate.current = clock.elapsedTime;
    }
    invalidate();
  });
  return <FreeWalkAvatar groupRef={avatar} legRefs={[leftLeg, rightLeg]} visible={viewMode === 'third'} />;
}
