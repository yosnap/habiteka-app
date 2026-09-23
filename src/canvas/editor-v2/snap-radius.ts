/**
 * Suelo en milímetros para el imán estructural (vértices y extremos de muro): con mucho zoom, un radio medido en
 * píxeles se vuelve inalcanzable con el ratón. Muebles, columnas y descansillos conservan su tolerancia en píxeles
 * porque ya cuentan con el ajuste a cara, que tiene su propio suelo de 150 mm.
 */
export const SNAP_FLOOR_MM = 50;

/** Alcance del imán estructural: `px` píxeles de pantalla convertidos a mm, nunca por debajo del suelo. */
export function snapRadiusMm(scale: number, px: number): number {
  return Math.max(SNAP_FLOOR_MM, px / Math.max(.001, scale));
}
