import type { Opening } from './schema';

const MIN_OPENING_MM = 50;

/**
 * Nuevo ancho y posición de un hueco al arrastrar uno de sus bordes a lo largo
 * del muro (`projected`: posición normalizada 0–1 del puntero sobre el muro).
 * Por defecto el borde opuesto se queda fijo y solo crece por el lado que se
 * arrastra; con `symmetric` (Alt) crece por ambos lados alrededor del centro.
 */
export function resizeOpeningFromEdge(opening: Pick<Opening, 'position' | 'widthMm'>, wallLengthMm: number,
  side: -1 | 1, projected: number, symmetric = false): { position: number; widthMm: number } {
  if (symmetric)
    return { position: opening.position, widthMm: Math.max(MIN_OPENING_MM, 2 * Math.abs(projected - opening.position) * wallLengthMm) };
  const fixed = opening.position - side * opening.widthMm / wallLengthMm / 2;
  const direction = Math.sign(projected - fixed) || side;
  const widthMm = Math.max(MIN_OPENING_MM, Math.abs(projected - fixed) * wallLengthMm);
  return { position: fixed + direction * widthMm / wallLengthMm / 2, widthMm };
}
