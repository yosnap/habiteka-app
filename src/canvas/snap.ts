/**
 * Núcleo de SNAP / magnetismo al mover objetos del plano (puro, sin React/Konva).
 *
 * Dado el AABB del objeto en movimiento y los AABB de los candidatos (otros objetos,
 * bordes de pared), calcula el desplazamiento (dx, dy) que ENGANCHA el objeto al
 * candidato más cercano por eje cuando está dentro de un umbral, más las líneas-guía a
 * dibujar (estilo CAD/Planner5D). El caller aplica dx/dy a la posición y pinta las guías.
 *
 * Alineaciones consideradas por eje: borde mínimo (izq/arriba), borde máximo (der/abajo)
 * y centro del objeto, contra esas mismas tres referencias de cada candidato. Solo cuentan
 * los candidatos cuya proyección en el OTRO eje se solapa con la del objeto (igual criterio
 * que `neighborGaps`): así "alinear a la izquierda" significa enfrente, no en diagonal.
 *
 * Reusa `WorldRect` (floating-menu-anchor) y la idea de solape de `live-dimensions`.
 */
import type { WorldRect } from './floating-menu-anchor';

/** Umbral de enganche por defecto en píxeles (decidido con el usuario). */
export const SNAP_THRESHOLD_PX = 8;

/** Resultado del cálculo de snap: corrección a aplicar + líneas-guía (coords de mundo). */
export interface SnapResult {
  /** Corrección en X a sumar a la posición propuesta (0 = sin enganche en X). */
  dx: number;
  /** Corrección en Y a sumar a la posición propuesta (0 = sin enganche en Y). */
  dy: number;
  /** Coordenadas X (mundo) de las líneas-guía VERTICALES a dibujar. */
  guidesX: number[];
  /** Coordenadas Y (mundo) de las líneas-guía HORIZONTALES a dibujar. */
  guidesY: number[];
}

/** ¿Se solapan los rangos [aMin,aMax] y [bMin,bMax]? (proyección sobre un eje). */
function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax;
}

/** Las tres referencias de alineación de un intervalo [min,max]: min, centro, max. */
function refLines(min: number, max: number): number[] {
  return [min, (min + max) / 2, max];
}

/**
 * Mejor enganche en un eje: para cada referencia del objeto (min/centro/max) contra cada
 * referencia del candidato, busca la de menor distancia bajo `threshold`. Devuelve el
 * desplazamiento con signo que alinea ambas referencias y la coordenada de la línea-guía
 * (la posición del candidato a la que se engancha), o `null` si nada engancha.
 */
function bestAxisSnap(
  movingMin: number,
  movingMax: number,
  candidates: Array<[number, number]>,
  threshold: number,
): { delta: number; guide: number } | null {
  const movingRefs = refLines(movingMin, movingMax);
  let best: { delta: number; guide: number; dist: number } | null = null;
  for (const [cMin, cMax] of candidates) {
    for (const cRef of refLines(cMin, cMax)) {
      for (const mRef of movingRefs) {
        const delta = cRef - mRef; // mover el objeto para que mRef caiga sobre cRef
        const dist = Math.abs(delta);
        if (dist <= threshold && (best === null || dist < best.dist)) {
          best = { delta, guide: cRef, dist };
        }
      }
    }
  }
  return best ? { delta: best.delta, guide: best.guide } : null;
}

/**
 * Calcula el snap del objeto `moving` a los `candidates` con el `threshold` dado. El
 * enganche de cada eje es independiente: un objeto puede engancharse solo en X, solo en Y,
 * en ambos o en ninguno. Las líneas-guía marcan las posiciones a las que se alineó.
 */
export function computeSnap(
  moving: WorldRect,
  candidates: WorldRect[],
  threshold: number = SNAP_THRESHOLD_PX,
): SnapResult {
  const mLeft = moving.x;
  const mRight = moving.x + moving.width;
  const mTop = moving.y;
  const mBottom = moving.y + moving.height;

  // Candidatos para el eje X: deben solaparse en Y (estar enfrente verticalmente).
  const xCandidates: Array<[number, number]> = [];
  // Candidatos para el eje Y: deben solaparse en X.
  const yCandidates: Array<[number, number]> = [];
  for (const c of candidates) {
    const cLeft = c.x;
    const cRight = c.x + c.width;
    const cTop = c.y;
    const cBottom = c.y + c.height;
    if (rangesOverlap(mTop, mBottom, cTop, cBottom)) xCandidates.push([cLeft, cRight]);
    if (rangesOverlap(mLeft, mRight, cLeft, cRight)) yCandidates.push([cTop, cBottom]);
  }

  const result: SnapResult = { dx: 0, dy: 0, guidesX: [], guidesY: [] };

  const sx = bestAxisSnap(mLeft, mRight, xCandidates, threshold);
  if (sx) {
    result.dx = sx.delta;
    result.guidesX.push(sx.guide);
  }
  const sy = bestAxisSnap(mTop, mBottom, yCandidates, threshold);
  if (sy) {
    result.dy = sy.delta;
    result.guidesY.push(sy.guide);
  }
  return result;
}

/** Rect de un muro en mundo + si es horizontal (más ancho que alto). */
interface WallRect extends WorldRect {
  horizontal: boolean;
}

/** Ajuste de extensión de un muro para cerrar esquinas: nuevos x/width o y/height. */
export interface WallStretch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** ¿El rect es de un muro horizontal? (su lado largo va en X). */
function isHorizontal(r: WorldRect): boolean {
  return r.width >= r.height;
}

/**
 * Extiende/recorta los EXTREMOS de un muro axis-aligned para que toquen la cara de los muros
 * PERPENDICULARES cercanos, cerrando las esquinas sin mover el extremo opuesto. A diferencia
 * de `computeSnap` (que traslada y solo cierra un extremo por eje), aquí cada extremo se ajusta
 * de forma independiente cambiando la longitud: así un muro horizontal puede tocar a la vez el
 * muro vertical izquierdo y el derecho. Pura y testeable.
 *
 * `moving` es el rect del muro en mundo (tras el snap de traslación). `candidates` son los rects
 * de los otros muros. Devuelve el ajuste (x/width para horizontales, y/height para verticales)
 * o `null` si ningún extremo engancha. Solo actúa sobre muros perpendiculares que se solapan en
 * el eje transversal (están "enfrente" del extremo).
 */
export function wallStretchToClose(
  moving: WallRect,
  candidates: WorldRect[],
  threshold: number = SNAP_THRESHOLD_PX,
): WallStretch | null {
  const horizontal = moving.horizontal;
  // Eje LONGITUDINAL (donde están los extremos) y TRANSVERSAL (donde debe haber solape).
  const startEnd = horizontal
    ? { lo: moving.x, hi: moving.x + moving.width, tLo: moving.y, tHi: moving.y + moving.height }
    : { lo: moving.y, hi: moving.y + moving.height, tLo: moving.x, tHi: moving.x + moving.width };

  // Caras candidatas perpendiculares: para cada muro perpendicular que se solapa en el eje
  // transversal, sus dos caras en el eje longitudinal son posibles puntos de cierre.
  let newLo = startEnd.lo;
  let newHi = startEnd.hi;
  let changed = false;
  for (const c of candidates) {
    const cHorizontal = isHorizontal(c);
    if (cHorizontal === horizontal) continue; // solo muros PERPENDICULARES cierran esquinas
    const cLongLo = horizontal ? c.x : c.y;
    const cLongHi = horizontal ? c.x + c.width : c.y + c.height;
    const cTransLo = horizontal ? c.y : c.x;
    const cTransHi = horizontal ? c.y + c.height : c.x + c.width;
    // Debe estar enfrente del muro en el eje transversal (su cara cruza la franja del muro).
    if (!rangesOverlap(startEnd.tLo, startEnd.tHi, cTransLo, cTransHi)) continue;
    // Cada cara del candidato es un posible cierre del extremo más cercano.
    for (const face of [cLongLo, cLongHi]) {
      if (Math.abs(face - startEnd.lo) <= threshold) {
        newLo = face;
        changed = true;
      }
      if (Math.abs(face - startEnd.hi) <= threshold) {
        newHi = face;
        changed = true;
      }
    }
  }
  if (!changed || newHi - newLo <= 0) return null;
  return horizontal
    ? { x: newLo, width: newHi - newLo }
    : { y: newLo, height: newHi - newLo };
}
