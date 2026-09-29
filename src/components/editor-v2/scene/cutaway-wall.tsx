'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, type Camera, type Group, type Material, type Object3D,
  type WebGLProgramParametersWithUniforms } from 'three';
import type { ExteriorWall } from '@/canvas/editor-v2/scene/types';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { floorFinish } from '@/lib/editor-document/floor-finishes';

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

/** Conserva el zócalo bajo el suelo elevado cuando se abre un alzado para ver una zona. */
export function cutawaySupportHeights(document: EditorDocument, wallIds: ReadonlySet<string>,
  levelElevationMm = 0): Map<string, number> {
  const rooms = deriveRoomsSafe(document);
  return new Map([...wallIds].flatMap((id) => {
    const elevations = rooms.filter((room) => room.wallIds.includes(id))
      .map((room) => floorFinish(document, room.id).elevationMm ?? 0);
    const wall = document.walls.find((item) => item.id === id);
    const supportMm = elevations.length ? Math.min(...elevations) : 0;
    return wall && supportMm > (wall.baseElevationMm ?? 0)
      ? [[id, (levelElevationMm + supportMm) / 1000] as const] : [];
  }));
}

/** Recorta temporalmente un muro por encima de su zócalo sin alterar su malla ni el plano. */
export function clipShaderAboveSupport(shader: WebGLProgramParametersWithUniforms, heightM: number): void {
  const project = '#include <project_vertex>';
  const main = /void\s+main\s*\(\s*\)\s*\{/;
  if (!shader.vertexShader.includes(project) || !main.test(shader.fragmentShader))
    throw new Error('No se puede preparar el zócalo de esta vista.');
  shader.vertexShader = `varying float vHabitekaCutawayY;\n${shader.vertexShader.replace(project,
    `vHabitekaCutawayY = (modelMatrix * vec4(transformed, 1.0)).y;\n${project}`)}`;
  shader.fragmentShader = `varying float vHabitekaCutawayY;\n${shader.fragmentShader.replace(main,
    (opening) => `${opening}\nif (vHabitekaCutawayY > ${heightM.toFixed(6)}) discard;`)}`;
}

/** Oculta tabiques y huecos; en muros con suelo elevado conserva solo la base portante. */
export function hideWallsByIds(root: Object3D, wallIds: ReadonlySet<string>,
  supportHeights: ReadonlyMap<string, number> = new Map()): () => void {
  const hidden: Object3D[] = [];
  const changed: { mesh: Mesh; material: Material | Material[] }[] = [];
  const supports: { object: Object3D; previous: unknown }[] = [];
  const copies: Material[] = [];
  const restore = () => {
    hidden.forEach((object) => { object.visible = true; });
    changed.forEach(({ mesh, material }) => { mesh.material = material; });
    supports.forEach(({ object, previous }) => {
      if (previous === undefined) delete object.userData.cutawaySupportHeightM;
      else object.userData.cutawaySupportHeightM = previous;
    });
    copies.forEach((material) => material.dispose());
  };
  try {
    root.traverse((object) => {
      const id = object.userData.cutawayWallId as string | undefined;
      if (!object.visible || !id || !wallIds.has(id)) return;
      const heightM = object.userData.cutawayStructural ? supportHeights.get(id) : undefined;
      if (heightM === undefined) { object.visible = false; hidden.push(object); return; }
      supports.push({ object, previous: object.userData.cutawaySupportHeightM });
      object.userData.cutawaySupportHeightM = heightM;
      object.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const original = child.material;
        const clipped = (material: Material) => {
          const copy = material.clone(), beforeCompile = material.onBeforeCompile;
          copy.onBeforeCompile = (shader, renderer) => {
            beforeCompile.call(copy, shader, renderer);
            clipShaderAboveSupport(shader, heightM);
          };
          copy.customProgramCacheKey = () => `${material.customProgramCacheKey()}|habiteka-support-${heightM}`;
          copies.push(copy);
          return copy;
        };
        changed.push({ mesh: child, material: original });
        child.material = Array.isArray(original) ? original.map(clipped) : clipped(original);
      });
    });
  } catch (error) { restore(); throw error; }
  return restore;
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
