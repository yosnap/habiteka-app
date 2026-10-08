import polygonClipping, { type Polygon } from 'polygon-clipping';

/** Bordes casi coincidentes de facetas/muros: misma rejilla, sin omitir el recorte si falla. */
export function roofPolygonIntersection(a: Polygon, b: Polygon): Polygon[] {
  const attempt = (precision: number): Polygon[] => {
    // Recortar coordenadas enteras evita que el algoritmo separe dos extremos
    // coincidentes por la representación binaria de fracciones como 0,075 m.
    const grid = (polygon: Polygon): Polygon => polygon.map(ring => ring.map(([x, y]) =>
      [Math.round(x * precision), Math.round(y * precision)]));
    return polygonClipping.intersection(grid(a), grid(b)).map(shape => shape.map(ring => ring.map(([x, y]) => [x / precision, y / precision])));
  };
  try { return polygonClipping.intersection(a, b); }
  catch {
    try { return attempt(1e6); }
    catch { return attempt(1e4); }
  }
}
