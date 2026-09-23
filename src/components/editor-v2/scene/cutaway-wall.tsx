'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera, Group, Object3D } from 'three';
import type { ExteriorWall } from '@/canvas/editor-v2/scene/types';

const facesCamera = (camera: Camera, wall: ExteriorWall) =>
  (camera.position.x - wall.x) * wall.normalX + (camera.position.z - wall.z) * wall.normalZ > .01;

/**
 * Oculta, sin pasar por React, los muros exteriores recortables que miran a la
 * cámara y devuelve cómo restaurarlos. Las capturas lo necesitan: el 3D tiene
 * su propio reconciliador y dibuja bajo demanda, así que un cambio de estado
 * no llega a tiempo a la foto.
 */
export function hideWallsFacingCamera(root: Object3D, camera: Camera): () => void {
  const hidden: Object3D[] = [];
  root.traverse((object) => {
    const wall = object.userData.cutawayExterior as ExteriorWall | undefined;
    if (wall && object.visible && facesCamera(camera, wall)) { object.visible = false; hidden.push(object); }
  });
  return () => hidden.forEach((object) => { object.visible = true; });
}

/**
 * Enciende para una captura la iluminación que el usuario ocultó en «Vista»:
 * ocultarla es para trabajar cómodo, pero techos y luces forman parte del diseño.
 */
export function revealHiddenLighting(root: Object3D): () => void {
  const revealed: Object3D[] = [];
  root.traverse((object) => {
    if (object.userData.lightingLayer && !object.visible) { object.visible = true; revealed.push(object); }
  });
  return () => revealed.forEach((object) => { object.visible = false; });
}

/** Camera-only visibility; selected walls remain present and the source document never changes. */
export function CutawayWall({ exterior, cuttable = true, enabled, selected, children }: {
  exterior?: ExteriorWall; cuttable?: boolean; enabled: boolean; selected: boolean; children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const cut = enabled && !selected ? exterior : undefined;
  // Restaurar el muro no puede depender de que se dibuje un fotograma: el bucle
  // es bajo demanda y una captura desde un punto de vista concreto no cambia
  // ninguna propiedad de la escena, así que podría no dibujarse ninguno y el
  // muro seguiría oculto por el recorte de la vista anterior.
  useLayoutEffect(() => {
    if (!cut && group.current && !group.current.visible) {
      group.current.visible = true;
      invalidate();
    }
  }, [cut, invalidate]);
  useFrame(({ camera }) => {
    if (!group.current || !cut) return;
    group.current.visible = !facesCamera(camera, cut);
  });
  return <group ref={group} userData={{ cutawayExterior: cuttable && !selected ? exterior : undefined }}>{children}</group>;
}
