/**
 * Lógica PURA de dibujo de muros como líneas rectas (F7.2). Convierte un segmento
 * (dos puntos en píxeles de plano) en un `StructObj` kind 'wall'. Sin Konva ni React.
 *
 * Modelo del muro: nace con su ESQUINA en el extremo `p1` desplazada media altura hacia
 * arriba (en el sistema local, antes de rotar), de modo que el EJE del muro pase por la
 * línea `p1→p2` y el grosor quede centrado sobre ella. Konva rota el objeto sobre esa
 * esquina (`structure-layer`), y `docToScene` calcula el centro respetando ese mismo pivote
 * (ver `objectCenterPx`), así que el muro casa en 2D y en 3D.
 */
import type { StructObj } from './types';
import type { CanvasScale } from './types';
import { metersToPx } from './scale';

/** Punto en píxeles de plano. */
export interface Point {
  x: number;
  y: number;
}

/** Grosor por defecto de un muro en metros (15 cm), coherente con el catálogo. */
export const DEFAULT_WALL_THICKNESS_M = 0.15;

/**
 * Longitud mínima de un muro (px) para considerarlo válido. Por debajo (doble clic en el
 * mismo punto, clic sin mover) se descarta para no crear muros degenerados de longitud 0
 * que en 3D dan geometría degenerada (red-team #9).
 */
export const MIN_WALL_LENGTH_PX = 4;

/** Longitud del segmento en píxeles. */
export function segmentLengthPx(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** Ángulo del segmento en grados (horario, sistema Y-abajo de Konva). */
export function segmentAngleDeg(p1: Point, p2: Point): number {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

/** ¿El segmento es lo bastante largo para ser un muro? */
export function isValidSegment(p1: Point, p2: Point): boolean {
  return segmentLengthPx(p1, p2) >= MIN_WALL_LENGTH_PX;
}

/**
 * Convierte un segmento `p1→p2` en un `StructObj` muro. El grosor sale de la escala
 * (`thicknessM` → px) o de un valor por defecto si no hay escala usable. Devuelve null si
 * el segmento es degenerado (más corto que `MIN_WALL_LENGTH_PX`).
 */
export function segmentToWall(
  id: string,
  p1: Point,
  p2: Point,
  scale: CanvasScale | null,
  thicknessM: number = DEFAULT_WALL_THICKNESS_M,
): StructObj | null {
  if (!isValidSegment(p1, p2)) return null;

  const length = segmentLengthPx(p1, p2);
  const angle = segmentAngleDeg(p1, p2);
  // Grosor en px: con escala, los metros reales; sin escala, un grosor visible por defecto.
  const thicknessPx = scale ? Math.max(2, metersToPx(thicknessM, scale)) : 12;

  // Konva rota el Group sobre su origen (x,y). Si la esquina fuera p1, el grosor colgaría
  // hacia un lado del eje. Para centrar el grosor sobre la línea p1→p2, desplazamos la
  // esquina media altura en la NORMAL del segmento (perpendicular), en el espacio de plano.
  const rad = (angle * Math.PI) / 180;
  // Normal unitaria (perpendicular a la dirección del muro), apuntando "hacia arriba" local.
  const nx = Math.sin(rad);
  const ny = -Math.cos(rad);
  const half = thicknessPx / 2;

  return {
    id,
    kind: 'wall',
    x: p1.x + nx * half,
    y: p1.y + ny * half,
    width: length,
    height: thicknessPx,
    rotation: angle,
  };
}
