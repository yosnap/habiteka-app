/**
 * Inversas exactas de `doc-to-scene.ts` (F2 editor 3D): convierte posición/rotación
 * worldspace del gizmo de vuelta a coordenadas del CanvasDoc (px, grados). Toda la
 * conversión es pura y testeada; ningún componente React la reimplementa a mano.
 *
 * Forward en doc-to-scene.ts:
 *   objectCenterPx(obj) → [cx, cy] en px
 *   planPointToXZ(obj, center, pxPerMeter) → [X, Z] en metros
 *   rotation2DToY(deg) → rotationY en radianes
 *
 * Inverso aquí:
 *   sceneXZToPlanCenterPx([X,Z], planCenterPx, pxPerMeter) → [cx, cy] en px
 *   planCenterPxToCorner(cx, cy, obj) → { x, y } esquina sup-izq en px
 *   rotationYToDoc(rotationY) → rotation en grados [0, 360)
 *   translatePatch(obj, [X,Z], scene) → { x, y } para updateObject
 *   rotatePatch(obj, rotationY, scene) → { rotation, x, y } para updateObject
 */
import type { StructObj } from '@/canvas/types';
import { objectCenterPx } from './doc-to-scene';

/** Subset de Scene3D que necesitan las funciones inversas. */
export interface SceneCoords {
  planCenterPx: [number, number];
  pxPerMeter: number;
}

/**
 * Inverso de `planPointToXZ`: convierte una posición worldspace [X, Z] en metros de
 * vuelta al centro del objeto en píxeles del plano 2D.
 */
export function sceneXZToPlanCenterPx(
  xz: [number, number],
  planCenterPx: [number, number],
  pxPerMeter: number,
): [number, number] {
  return [xz[0] * pxPerMeter + planCenterPx[0], xz[1] * pxPerMeter + planCenterPx[1]];
}

/**
 * Inverso de `objectCenterPx`: dado el CENTRO (cx, cy) en px y el StructObj actual
 * (rotation, width, height), devuelve la esquina sup-izq (x, y) que Konva usa como
 * origen del objeto.
 *
 * Despejando de cx = x + hw·cos − hh·sin → x = cx − (hw·cos − hh·sin)
 *               cy = y + hw·sin + hh·cos → y = cy − (hw·sin + hh·cos)
 */
export function planCenterPxToCorner(
  cx: number,
  cy: number,
  obj: Pick<StructObj, 'rotation' | 'width' | 'height'>,
): { x: number; y: number } {
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  return {
    x: cx - (hw * cos - hh * sin),
    y: cy - (hw * sin + hh * cos),
  };
}

/**
 * Inverso de `rotation2DToY`: rotationY (radianes, eje Y en 3D) → rotation (grados,
 * sentido horario en 2D), normalizado a [0, 360).
 */
export function rotationYToDoc(rotationY: number): number {
  const deg = (-(rotationY || 0) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/**
 * Calcula el patch `{ x, y }` tras mover un mueble en el gizmo.
 * Recibe la nueva posición worldspace [X, Z] del grupo raíz del Object3D (y = 0 siempre).
 */
export function translatePatch(
  obj: StructObj,
  xz: [number, number],
  scene: SceneCoords,
): { x: number; y: number } {
  const [cx, cy] = sceneXZToPlanCenterPx(xz, scene.planCenterPx, scene.pxPerMeter);
  return planCenterPxToCorner(cx, cy, obj);
}

/**
 * Calcula el patch `{ rotation, x, y }` tras rotar un mueble en el gizmo, manteniendo
 * el CENTRO del objeto fijo (corrige el pivote-esquina de Konva).
 *
 * Pasos:
 *  1. Centro actual del objeto (antes de la rotación) = fijo.
 *  2. Nuevo ángulo en grados.
 *  3. Nueva esquina (x, y) que mantiene ese centro con el nuevo ángulo.
 */
export function rotatePatch(
  obj: StructObj,
  rotationY: number,
  _scene: SceneCoords,
): { rotation: number; x: number; y: number } {
  const [cx, cy] = objectCenterPx(obj);
  const rotation = rotationYToDoc(rotationY);
  const { x, y } = planCenterPxToCorner(cx, cy, { ...obj, rotation });
  return { rotation, x, y };
}
