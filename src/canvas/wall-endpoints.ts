/**
 * Extremos del EJE de un muro (p1/p2 en coordenadas de mundo) a partir de su
 * caja x/y/width/height/rotation. Lógica pura compartida: la usan el inglete
 * de esquinas (render) y el imán de extremos al dibujar muros — para que
 * "cerrar una esquina" signifique lo mismo en todas partes.
 */
import type { Point2D, StructObj } from './types';

export interface WallAxis {
  p1: Point2D;
  p2: Point2D;
}

/** Extremos del eje del muro; null si el objeto no es un muro. */
export function wallAxisEndpoints(o: StructObj): WallAxis | null {
  if (o.kind !== 'wall') return null;

  if (o.drawn) {
    // Muro dibujado: el group pivota en p1 desplazado media altura por la normal.
    const angle = (o.rotation * Math.PI) / 180;
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    const half = o.height / 2;
    const p1 = { x: o.x - nx * half, y: o.y - ny * half };
    return {
      p1,
      p2: { x: p1.x + Math.cos(angle) * o.width, y: p1.y + Math.sin(angle) * o.width },
    };
  }

  // Muro de plantilla (rotation ≈ 0): la orientación se infiere de la proporción.
  if (o.width >= o.height) {
    const half = o.height / 2;
    return {
      p1: { x: o.x, y: o.y + half },
      p2: { x: o.x + o.width, y: o.y + half },
    };
  }
  const half = o.width / 2;
  return {
    p1: { x: o.x + half, y: o.y },
    p2: { x: o.x + half, y: o.y + o.height },
  };
}

/**
 * Extremo de muro existente más cercano a `p` dentro de `tolerance` px de
 * mundo, o null. Es el imán que cierra esquinas al dibujar: aterrizar EXACTO
 * en el vértice del muro vecino, sin pulso.
 */
export function nearestWallEndpoint(
  p: Point2D,
  objects: StructObj[],
  tolerance: number,
): Point2D | null {
  let best: Point2D | null = null;
  let bestDist = tolerance;
  for (const o of objects) {
    const axis = wallAxisEndpoints(o);
    if (!axis) continue;
    for (const end of [axis.p1, axis.p2]) {
      const d = Math.hypot(p.x - end.x, p.y - end.y);
      if (d < bestDist) {
        bestDist = d;
        best = end;
      }
    }
  }
  return best;
}
