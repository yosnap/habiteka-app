/**
 * Medición EN VIVO para mover/redimensionar objetos (cota estilo Planner5D/CAD).
 *
 * El tamaño del objeto ya lo formatea `formatObjectSize` (scale.ts); aquí va solo la
 * pieza nueva: las distancias (huecos) del objeto en movimiento a sus VECINOS más
 * cercanos en cada lado. Lógica PURA (sin React/Konva) para poder testearla.
 *
 * Aproximación honesta (predict): las distancias se miden sobre AABB eje-alineados.
 * Con objetos rotados a ángulos no múltiplos de 90° la proyección es aproximada, como
 * en cualquier editor 2D; no se calcula la distancia mínima entre polígonos rotados.
 *
 * MVP: distancia a otros OBJETOS. La distancia a las paredes de la sala queda como
 * mejora futura (requiere los bounds de la zona activa).
 */
import type { WorldRect } from './floating-menu-anchor';
import type { CanvasScale } from './types';
import { pxToMeters } from './scale';

/** Huecos a los vecinos más cercanos en cada lado, en METROS. `undefined` = sin vecino. */
export interface NeighborGaps {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/** ¿Se solapan los rangos [aMin,aMax] y [bMin,bMax]? (proyección sobre un eje). */
function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax;
}

/**
 * Distancias del AABB `moving` a los vecinos más cercanos en los 4 lados, en metros.
 *
 * Para cada lado se considera solo a los vecinos cuya proyección en el OTRO eje se
 * solapa con la de `moving` (así "a la derecha" significa realmente enfrente, no en
 * diagonal) Y que están claramente a ese lado (su borde no cruza el de `moving`). Un
 * objeto que se solapa con `moving` no produce cota: no hay "hueco" que medir y el
 * solape se ve directamente. El gap es la separación de bordes en metros.
 */
export function neighborGaps(
  moving: WorldRect,
  others: WorldRect[],
  scale: CanvasScale,
): NeighborGaps {
  const mLeft = moving.x;
  const mRight = moving.x + moving.width;
  const mTop = moving.y;
  const mBottom = moving.y + moving.height;

  let right = Infinity;
  let left = Infinity;
  let bottom = Infinity;
  let top = Infinity;

  for (const o of others) {
    const oLeft = o.x;
    const oRight = o.x + o.width;
    const oTop = o.y;
    const oBottom = o.y + o.height;

    // Horizontal: el vecino debe solaparse en el eje Y para contar como izq/der.
    if (rangesOverlap(mTop, mBottom, oTop, oBottom)) {
      if (oLeft >= mRight) right = Math.min(right, oLeft - mRight); // vecino a la derecha
      if (oRight <= mLeft) left = Math.min(left, mLeft - oRight); // vecino a la izquierda
    }
    // Vertical: el vecino debe solaparse en el eje X para contar como arriba/abajo.
    if (rangesOverlap(mLeft, mRight, oLeft, oRight)) {
      if (oTop >= mBottom) bottom = Math.min(bottom, oTop - mBottom); // vecino debajo
      if (oBottom <= mTop) top = Math.min(top, mTop - oBottom); // vecino encima
    }
  }

  const toM = (px: number): number => Math.max(0, pxToMeters(px, scale));
  const gaps: NeighborGaps = {};
  if (right !== Infinity) gaps.right = toM(right);
  if (left !== Infinity) gaps.left = toM(left);
  if (bottom !== Infinity) gaps.bottom = toM(bottom);
  if (top !== Infinity) gaps.top = toM(top);
  return gaps;
}
