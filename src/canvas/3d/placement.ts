/**
 * Cálculo de posición 3D según PlacementRule (F2).
 *
 * La posición X/Z de un objeto la calcula `planPointToXZ` en doc-to-scene.
 * Este módulo solo resuelve el eje Y (vertical) según cómo se coloca el objeto:
 *
 *   floor      → y = elevationM + heightM/2          (base en suelo o encimera)
 *   ceiling    → y = ceilingHeightM - dropM - hm/2   (cuelga del techo)
 *   wall-child → y = elevationM + heightM/2           (igual que floor; se posiciona sobre el muro)
 *   wall-surface → y = elevationM + heightM/2         (igual que floor)
 *   wall       → y = ceilingHeightM/2                 (muro: centro entre suelo y techo)
 *
 * Lógica pura y testeable, sin dependencias de React ni Three.
 */
import type { StructObj, WallSurfaceKind } from '../types';
import { placementOf } from '../types';
import { effectiveHeightM } from '../scale';

/**
 * Altura de la BASE del elemento sobre el suelo (metros) para items de superficie de muro,
 * cuando el objeto no trae `elevationM` propio. Valores realistas de instalación.
 */
export const WALL_SURFACE_ELEVATION_M: Partial<Record<WallSurfaceKind, number>> = {
  outlet: 0.3, // enchufe a 30 cm del suelo
  switch: 1.2, // interruptor a 1,2 m
  thermostat: 1.4, // termostato a 1,4 m
  tv_mount: 1.1, // TV centrado a ~1,1 m
  wall_sconce: 1.7, // aplique alto
  art_frame: 1.5, // cuadro centrado a ~1,5 m
  radiator: 0.15, // radiador con base baja
};

/** Elevación efectiva (m) de un item de superficie de muro: la del objeto o la por defecto. */
export function wallSurfaceElevationM(kind: WallSurfaceKind, elevationM?: number): number {
  return elevationM ?? WALL_SURFACE_ELEVATION_M[kind] ?? 1.2;
}

/**
 * Tamaño 3D real (metros) de un item de superficie de muro: [ancho (a lo largo del muro),
 * alto (vertical), profundidad (perpendicular al muro)]. El plano 2D no codifica el alto
 * vertical de estos elementos, así que el render usa esta tabla realista por kind.
 */
export const WALL_SURFACE_SIZE_M: Record<WallSurfaceKind, [number, number, number]> = {
  outlet: [0.08, 0.08, 0.04],
  switch: [0.08, 0.08, 0.04],
  thermostat: [0.12, 0.12, 0.04],
  tv_mount: [1.2, 0.7, 0.08],
  wall_sconce: [0.12, 0.15, 0.1],
  art_frame: [0.6, 0.8, 0.04],
  radiator: [0.6, 0.9, 0.1],
};

/**
 * Retorna el centro Y (metros) de un objeto en la escena 3D según su placement.
 *
 * @param obj         Objeto del doc: necesita kind, heightM y elevationM.
 * @param ceilingHeightM  Altura de techo efectiva del plano (metros).
 */
export function objectCenterY(
  obj: Pick<StructObj, 'kind' | 'heightM' | 'elevationM'>,
  ceilingHeightM: number,
): number {
  const placement = placementOf(obj.kind);
  const hm = effectiveHeightM(obj, ceilingHeightM);

  if (placement === 'ceiling') {
    // elevationM = distancia desde el techo hacia abajo (0 = enrasado al techo)
    const dropM = obj.elevationM ?? 0;
    return ceilingHeightM - dropM - hm / 2;
  }

  // floor | wall-child | wall-surface | wall
  const elevM = obj.elevationM ?? 0;
  return elevM + hm / 2;
}

/**
 * ¿El objeto ocupa espacio en el plano XZ del suelo y puede colisionar con otros
 * muebles? Solo objetos floor SIN elevación (apoyados en el suelo, no encimeras).
 * Los objetos de techo, pared o a distinta elevación no colisionan con el suelo.
 */
export function isFloorCollidable(
  obj: Pick<StructObj, 'kind' | 'elevationM'>,
): boolean {
  if (placementOf(obj.kind) !== 'floor') return false;
  return (obj.elevationM ?? 0) < 0.1; // < 10 cm de elevación = apoyado en el suelo
}
