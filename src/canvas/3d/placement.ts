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
import type { StructObj } from '../types';
import { placementOf } from '../types';
import { effectiveHeightM } from '../scale';

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
