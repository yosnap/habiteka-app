/**
 * Plantillas declarativas de auto-amueblado por tipo de sala (F7.5). Cada entrada coloca un
 * `kind` del catálogo pegado a una pared (o al centro), posicionado a lo largo de ella por
 * una fracción, y con una rotación. Sin IA: reglas simples y deterministas, estilo Planner5D.
 *
 * Convención de ejes (Konva, Y-abajo): 'N' = pared superior (y menor), 'S' = inferior,
 * 'O' = izquierda (x menor), 'E' = derecha. `along` ∈ [0,1] = posición a lo largo de la pared
 * (0 = esquina inicial, 1 = esquina final). `rotation` en grados (0 = el "frente" mira al sur).
 */
import type { StructKind } from '../types';
import type { RoomType } from './room-types';

export type WallAnchor = 'N' | 'S' | 'E' | 'O' | 'center';

export interface FurniturePlacement {
  kind: StructKind;
  /** Pared a la que se ancla (o 'center' para el medio de la sala). */
  anchor: WallAnchor;
  /** Posición a lo largo de la pared/eje, 0–1. */
  along: number;
  /** Rotación en grados (Konva). */
  rotation: number;
}

/**
 * Sets por tipo de sala. Solo kinds del catálogo. Disposiciones con sentido: el sofá mira
 * al interior desde una pared, la TV enfrente, la cama con cabecera a la pared, etc.
 */
export const FURNISH_TEMPLATES: Record<RoomType, FurniturePlacement[]> = {
  salon: [
    { kind: 'sofa', anchor: 'S', along: 0.5, rotation: 180 }, // sofá contra pared sur, mirando al norte
    { kind: 'tv', anchor: 'N', along: 0.5, rotation: 0 }, // TV contra pared norte
    { kind: 'mesa', anchor: 'center', along: 0.5, rotation: 0 }, // mesa de centro
    { kind: 'lampara', anchor: 'E', along: 0.15, rotation: 0 }, // lámpara en una esquina
  ],
  dormitorio: [
    { kind: 'cama', anchor: 'N', along: 0.5, rotation: 0 }, // cabecera a la pared norte
    { kind: 'mesilla', anchor: 'N', along: 0.18, rotation: 0 },
    { kind: 'mesilla', anchor: 'N', along: 0.82, rotation: 0 },
    { kind: 'armario', anchor: 'S', along: 0.5, rotation: 180 },
  ],
  cocina: [
    { kind: 'encimera', anchor: 'N', along: 0.5, rotation: 0 },
    { kind: 'fregadero', anchor: 'N', along: 0.25, rotation: 0 },
    { kind: 'nevera', anchor: 'O', along: 0.15, rotation: 90 },
    { kind: 'horno', anchor: 'N', along: 0.75, rotation: 0 },
  ],
  bano: [
    { kind: 'banera', anchor: 'S', along: 0.5, rotation: 0 },
    { kind: 'inodoro', anchor: 'O', along: 0.2, rotation: 90 },
    { kind: 'lavabo', anchor: 'N', along: 0.3, rotation: 0 },
    { kind: 'ducha', anchor: 'E', along: 0.2, rotation: 270 },
  ],
};
