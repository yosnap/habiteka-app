'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3 } from 'three';
import type { Point } from '@/lib/editor-document/schema';
import { findWalkablePath } from '@/lib/editor-document/walkthrough-navigation';
import type {
  buildingWalkNavigation,
  BuildingWalkPosition,
} from '@/lib/editor-document/building-free-walk';
import type { FreeWalkController } from './free-walk-controller';

/** Camina por rutas transitables de la planta actual; un arrastre solo cambia la mirada. */
export function useClickWalk(
  building: ReturnType<typeof buildingWalkNavigation>,
  controller: FreeWalkController,
  paused: boolean,
) {
  const { gl, get, invalidate } = useThree();
  const path = useRef<Point[]>([]),
    pathLevel = useRef<string | null>(null);
  useEffect(() => {
    path.current = [];
    if (paused) {
      controller.setMessage('Desplazamiento detenido. Pulsa otro punto para continuar.');
      return;
    }
    const canvas = gl.domElement,
      ray = new Raycaster();
    let down: { x: number; y: number; moved: boolean } | null = null;
    const start = (event: PointerEvent) => {
      if (event.button === 0) down = { x: event.clientX, y: event.clientY, moved: false };
    };
    const move = (event: PointerEvent) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
    };
    const end = (event: PointerEvent) => {
      if (!down || down.moved) {
        down = null;
        return;
      }
      down = null;
      const pose = controller.getPose(),
        level = building.levels.find((item) => item.id === pose?.levelId);
      const nav = pose?.levelId ? building.navs.get(pose.levelId) : null;
      if (!pose || !level || !nav) return;
      const rect = canvas.getBoundingClientRect();
      const locked = window.document.pointerLockElement === canvas;
      ray.setFromCamera(
        locked
          ? new Vector2(0, 0)
          : new Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            ),
        get().camera,
      );
      // El primer objeto visible impide apuntar a suelo detrás de una pared o un mueble.
      const hit = ray.intersectObjects(get().scene.children, true).find((entry) => {
        let node = entry.object;
        if (!node.layers.test(get().camera.layers)) return false;
        while (node.parent) {
          if (!node.visible) return false;
          node = node.parent;
        }
        return node.visible && !!entry.face;
      });
      path.current = [];
      if (!hit?.face) return;
      const point = { x: hit.point.x * 1000, y: hit.point.z * 1000 };
      const normal = new Vector3().copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (
        normal.y < 0.5 ||
        Math.abs(hit.point.y * 1000 - level.elevationMm - nav.floorAt(point)) > 120 ||
        !nav.free(point)
      ) {
        controller.setMessage('Pulsa un punto de suelo libre y visible en esta planta.');
        return;
      }
      try {
        path.current = findWalkablePath(nav, pose, point).slice(1);
        pathLevel.current = level.id;
        controller.setMessage(
          'Caminando al punto indicado. Usa las flechas o pausa para detenerte.',
        );
        invalidate();
      } catch (error) {
        controller.setMessage(
          error instanceof Error ? error.message : 'No hay un paso transitable.',
        );
      }
    };
    const cancel = () => {
      down = null;
    };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', cancel);
    return () => {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', cancel);
      path.current = [];
    };
  }, [building, controller, paused, gl, get, invalidate]);
  return (from: BuildingWalkPosition, manual: boolean, distance: number): Point | null => {
    if (manual || from.levelId !== pathLevel.current) {
      if (path.current.length)
        controller.setMessage('Desplazamiento detenido. Pulsa otro punto para continuar.');
      path.current = [];
      return null;
    }
    const wasWalking = path.current.length > 0;
    while (
      path.current[0] &&
      Math.hypot(path.current[0].x - from.point.x, path.current[0].y - from.point.y) < 20
    )
      path.current.shift();
    const target = path.current[0];
    if (!target) {
      if (wasWalking)
        controller.setMessage('Has llegado. Pulsa otro punto del suelo para continuar.');
      return null;
    }
    const dx = target.x - from.point.x,
      dy = target.y - from.point.y,
      length = Math.hypot(dx, dy);
    const scale = Math.min(1, distance / length);
    return { x: dx * scale, y: dy * scale };
  };
}
