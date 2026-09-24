/**
 * Selección por zona de luces: qué luminarias y qué tiras caen dentro de un
 * polígono guardado en el documento.
 *
 * Criterio documentado: el borde CUENTA como dentro (con una tolerancia de
 * 1 mm), para que una luz alineada con el trazo de la zona no se escape de la
 * selección. Una tira entra si su recorrido resuelto toca la zona, aunque solo
 * la cruce en parte.
 */
import { insideRoom } from './ceiling-geometry';
import { distanceToSegment } from './polygon-tools';
import { resolvedStrips } from './light-strip-geometry';
import type { EditorDocument, LightStrip, Luminaire, Point } from './schema';

/** Holgura del borde: un punto a menos de 1 mm del trazo se considera dentro. */
export const ZONE_EDGE_TOLERANCE_MM = 1;

/** ¿El punto cae dentro de la zona (borde incluido)? */
export function pointInZone(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false;
  if (insideRoom(point, polygon as Point[])) return true;
  return polygon.some(
    (vertex, index) =>
      distanceToSegment(point, vertex, polygon[(index + 1) % polygon.length]!) <=
      ZONE_EDGE_TOLERANCE_MM,
  );
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return distanceToSegment(point, a, b) <= ZONE_EDGE_TOLERANCE_MM;
}

function side(a: Point, b: Point, point: Point): number {
  const value = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Corte de dos segmentos, contando también los que solo se tocan. */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const s1 = side(a, b, c);
  const s2 = side(a, b, d);
  const s3 = side(c, d, a);
  const s4 = side(c, d, b);
  if (s1 !== s2 && s3 !== s4) return true;
  return (
    (s1 === 0 && onSegment(a, b, c)) ||
    (s2 === 0 && onSegment(a, b, d)) ||
    (s3 === 0 && onSegment(c, d, a)) ||
    (s4 === 0 && onSegment(c, d, b))
  );
}

/** ¿El recorrido toca la zona? Basta con que entre un tramo. */
export function pathTouchesZone(path: readonly Point[], polygon: readonly Point[]): boolean {
  if (polygon.length < 3 || path.length < 1) return false;
  if (path.some((point) => pointInZone(point, polygon))) return true;
  for (let i = 1; i < path.length; i++)
    for (let j = 0; j < polygon.length; j++)
      if (
        segmentsIntersect(
          path[i - 1]!,
          path[i]!,
          polygon[j]!,
          polygon[(j + 1) % polygon.length]!,
        )
      )
        return true;
  return false;
}

/**
 * ¿El punto cae dentro de alguna parte de la zona? Una zona puede tener varios
 * contornos sueltos (varias estancias), y basta con estar dentro de uno.
 */
export function pointInZoneParts(point: Point, polygons: readonly (readonly Point[])[]): boolean {
  return polygons.some((polygon) => pointInZone(point, polygon));
}

/** ¿El recorrido toca alguna parte de la zona? */
export function pathTouchesZoneParts(
  path: readonly Point[],
  polygons: readonly (readonly Point[])[],
): boolean {
  return polygons.some((polygon) => pathTouchesZone(path, polygon));
}

/** Luminarias cuyo centro cae dentro de alguna parte de la zona. */
export function lightsInZone(doc: EditorDocument, polygons: readonly (readonly Point[])[]): Luminaire[] {
  return (doc.luminaires ?? []).filter((light) => pointInZoneParts(light, polygons));
}

/**
 * Tiras cuyo recorrido interseca la zona. Se usa el recorrido resuelto (el que
 * se ve en el plano); si la tira tiene incidencias y no resuelve, se cae al
 * recorrido guardado para no perderla de la selección.
 */
export function stripsInZone(doc: EditorDocument, polygons: readonly (readonly Point[])[]): LightStrip[] {
  if (!doc.lightStrips?.length) return [];
  let resolved: Map<string, Point[]>;
  try {
    resolved = new Map(resolvedStrips(doc).map((item) => [item.strip.id, item.pathMm]));
  } catch {
    resolved = new Map();
  }
  return doc.lightStrips.filter((strip) =>
    pathTouchesZoneParts(resolved.get(strip.id) ?? strip.pathMm, polygons),
  );
}
