/**
 * Edición PURA del contorno (polígono rectilíneo) de una sala: mover, añadir y quitar
 * vértices manteniendo la ORTOGONALIDAD (todas las aristas horizontales o verticales).
 * Sin React/Konva: la capa de UI llama a estas funciones y persiste el resultado con
 * `setFloorOutline` (que regenera los muros). Reusa el modelo `FloorVertex` del doc.
 */
import type { FloorVertex } from '../types';

/** ¿Dos números son (casi) iguales? (tolerancia para px). */
function eq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

/**
 * Mueve el vértice `i` a `(x, y)` manteniendo la ortogonalidad del contorno. En un polígono
 * rectilíneo, el vértice `i` une una arista con su vecino ANTERIOR y otra con el SIGUIENTE;
 * una es horizontal (comparten Y) y la otra vertical (comparten X). Al mover `i`, el vecino
 * que compartía X con él lo sigue en X, y el que compartía Y lo sigue en Y, de modo que las
 * dos aristas siguen siendo axis-aligned. Devuelve un nuevo array (no muta el de entrada).
 */
export function moveVertexOrtho(
  outline: FloorVertex[],
  i: number,
  x: number,
  y: number,
): FloorVertex[] {
  const n = outline.length;
  if (n < 3 || i < 0 || i >= n) return outline;
  const cur = outline[i]!;
  const prev = outline[(i - 1 + n) % n]!;
  const next = outline[(i + 1) % n]!;
  const result = outline.map((p) => ({ ...p }));

  result[i] = { x, y };
  // El vecino que compartía la X de `cur` mantiene la arista vertical → toma la nueva X.
  // El que compartía la Y mantiene la arista horizontal → toma la nueva Y.
  if (eq(prev.x, cur.x)) result[(i - 1 + n) % n]!.x = x;
  if (eq(prev.y, cur.y)) result[(i - 1 + n) % n]!.y = y;
  if (eq(next.x, cur.x)) result[(i + 1) % n]!.x = x;
  if (eq(next.y, cur.y)) result[(i + 1) % n]!.y = y;
  return result;
}

/**
 * Inserta un vértice en el punto medio de la arista `edgeIndex` (entre el vértice `edgeIndex`
 * y el siguiente). El nuevo vértice queda sobre la arista (mantiene la forma); al moverlo
 * luego se crea un escalón. Devuelve un nuevo array con un vértice más.
 */
export function insertVertexOnEdge(outline: FloorVertex[], edgeIndex: number): FloorVertex[] {
  const n = outline.length;
  if (n < 3 || edgeIndex < 0 || edgeIndex >= n) return outline;
  const a = outline[edgeIndex]!;
  const b = outline[(edgeIndex + 1) % n]!;
  const mid: FloorVertex = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const result = outline.map((p) => ({ ...p }));
  result.splice(edgeIndex + 1, 0, mid);
  return result;
}

/**
 * Quita el vértice `i`. Devuelve el nuevo contorno, o `null` si el resultado no sería válido
 * (menos de 4 vértices o polígono degenerado). El llamador descarta el cambio si es null.
 */
export function removeVertex(outline: FloorVertex[], i: number): FloorVertex[] | null {
  const n = outline.length;
  if (n <= 4 || i < 0 || i >= n) return null; // un rectángulo (4) es el mínimo
  const result = outline.filter((_, idx) => idx !== i);
  return isValidOutline(result) ? result : null;
}

/** Área (con signo) del polígono por la fórmula del cordón (shoelace). */
function signedArea(pts: FloorVertex[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** ¿Se cruzan los segmentos [a,b] y [c,d]? (intersección propia, sin contar extremos compartidos). */
function segmentsCross(a: FloorVertex, b: FloorVertex, c: FloorVertex, d: FloorVertex): boolean {
  const o = (p: FloorVertex, q: FloorVertex, r: FloorVertex) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/**
 * ¿El contorno es un polígono simple válido? Exige ≥4 vértices, área no nula y ninguna
 * auto-intersección entre aristas no adyacentes. (No exige ortogonalidad: el editor la
 * mantiene; aquí solo se evita un polígono roto.)
 */
export function isValidOutline(outline: FloorVertex[]): boolean {
  const n = outline.length;
  if (n < 4) return false;
  if (Math.abs(signedArea(outline)) < 1e-6) return false;
  for (let i = 0; i < n; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Saltar aristas adyacentes (comparten un vértice).
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = outline[j]!;
      const d = outline[(j + 1) % n]!;
      if (segmentsCross(a, b, c, d)) return false;
    }
  }
  return true;
}
