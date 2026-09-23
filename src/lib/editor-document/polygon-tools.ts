/**
 * Utilidades puras de polígonos para zonas de render y contornos de estancia.
 *
 * Son las operaciones que necesita dibujar una zona a mano (cerrar, validar,
 * acotar el número de vértices) y las que necesita el prompt para no reventar
 * la cuota de caracteres. Todas trabajan en las unidades que reciben: quien
 * llama decide si son milímetros del plano o metros del contexto.
 */

export interface PlanePoint {
  x: number;
  y: number;
}

/** Mínimo de vértices de una zona válida (igual que el esquema de opciones de render). */
export const MIN_POLYGON_POINTS = 3;
/** Máximo de vértices que admite una zona de render. */
export const MAX_POLYGON_POINTS = 20;

const cross = (o: PlanePoint, a: PlanePoint, b: PlanePoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Distancia de un punto al segmento a-b. */
export function distanceToSegment(point: PlanePoint, a: PlanePoint, b: PlanePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Douglas-Peucker sobre una polilínea abierta. */
function simplifyOpen(points: PlanePoint[], tolerance: number): PlanePoint[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let index = -1;
  let farthest = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i]!, first, last);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest <= tolerance) return [first, last];
  return [
    ...simplifyOpen(points.slice(0, index + 1), tolerance),
    ...simplifyOpen(points.slice(index), tolerance).slice(1),
  ];
}

/**
 * Simplifica un contorno cerrado conservando su forma: quita los vértices que
 * caen a menos de `tolerance` de la recta que une a sus vecinos, que es lo que
 * ocurre con los puntos de muestreo de un muro recto.
 */
export function simplifyPolygon(polygon: readonly PlanePoint[], tolerance: number): PlanePoint[] {
  if (polygon.length <= MIN_POLYGON_POINTS || tolerance <= 0) return [...polygon];
  const open = [...polygon, polygon[0]!];
  const simplified = simplifyOpen(open, tolerance);
  const closed = simplified.slice(0, -1);
  return closed.length >= MIN_POLYGON_POINTS ? closed : [...polygon];
}

/**
 * Deja el contorno en `max` vértices como mucho, subiendo la tolerancia hasta
 * conseguirlo. La forma se mantiene reconocible porque siempre se eliminan
 * antes los vértices menos significativos.
 */
export function limitPolygonVertices(
  polygon: readonly PlanePoint[],
  max: number = MAX_POLYGON_POINTS,
): PlanePoint[] {
  if (polygon.length <= max) return [...polygon];
  const span = Math.max(
    Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)),
    Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y)),
  );
  let result = [...polygon];
  for (let tolerance = span / 2000 || 1; tolerance <= span; tolerance *= 1.6) {
    result = simplifyPolygon(polygon, tolerance);
    if (result.length <= max) return result;
  }
  // Reparto uniforme: si ni así cabe, se conservan vértices equiespaciados.
  const step = polygon.length / max;
  return Array.from({ length: max }, (_, index) => polygon[Math.floor(index * step)]!);
}

/** ¿El punto cae dentro del polígono? Regla par-impar; el borde exacto queda indefinido. */
export function pointInPolygon(point: PlanePoint, polygon: readonly PlanePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function segmentsCross(a: PlanePoint, b: PlanePoint, c: PlanePoint, d: PlanePoint): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

/**
 * ¿El contorno se cruza consigo mismo? Una zona con lazos no describe un área
 * que el modelo pueda respetar, así que se rechaza al cerrarla.
 */
export function polygonSelfIntersects(polygon: readonly PlanePoint[]): boolean {
  const count = polygon.length;
  if (count < 4) return false;
  for (let i = 0; i < count; i++)
    for (let j = i + 1; j < count; j++) {
      // Lados consecutivos (y el par primero-último) comparten vértice: no cuentan.
      if (j === i + 1 || (i === 0 && j === count - 1)) continue;
      if (
        segmentsCross(
          polygon[i]!,
          polygon[(i + 1) % count]!,
          polygon[j]!,
          polygon[(j + 1) % count]!,
        )
      )
        return true;
    }
  return false;
}
