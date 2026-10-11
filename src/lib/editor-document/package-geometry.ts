import type { EditorDocument, Point } from './schema';
import { localToWorld } from './spatial-properties';

export function packageBounds(doc: EditorDocument) {
  const points: Point[] = [...doc.vertices, ...doc.labels, ...(doc.luminaires ?? [])];
  for (const item of [...doc.furniture, ...(doc.boundaries ?? []), ...(doc.kitchenRuns ?? []),
    ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])])
    points.push(...[{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }].map(p => localToWorld(item, p)));
  for (const surface of doc.terrainSurfaces ?? []) points.push(surface, { x: surface.x + surface.widthMm, y: surface.y + surface.depthMm });
  for (const dimension of doc.dimensions) points.push(dimension.from, dimension.to);
  for (const zone of doc.designZones ?? []) points.push(...zone.polygon);
  for (const zone of doc.lightZones ?? []) points.push(...zone.polygonsMm.flat());
  for (const strip of doc.lightStrips ?? []) points.push(...strip.pathMm);
  for (const route of doc.walkthroughs ?? []) points.push(...route.waypoints);
  if (!points.length) throw new Error('El paquete no contiene geometría que se pueda colocar.');
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  return { minX, minY, width: Math.max(1, Math.max(...points.map(p => p.x)) - minX),
    height: Math.max(1, Math.max(...points.map(p => p.y)) - minY) };
}

/** Solo traslada coordenadas globales; no mueve los anclajes locales de muebles y módulos. */
export function translatePackage(doc: EditorDocument, delta: Point): EditorDocument {
  const next = structuredClone(doc), move = (p: Point) => { p.x += delta.x; p.y += delta.y; };
  [...next.vertices, ...next.furniture, ...next.labels, ...(next.boundaries ?? []), ...(next.kitchenRuns ?? []),
    ...(next.stairs ?? []), ...(next.ramps ?? []), ...(next.columns ?? []), ...(next.terrainSurfaces ?? []),
    ...(next.luminaires ?? [])].forEach(move);
  next.dimensions.forEach(item => { move(item.from); move(item.to); });
  next.designZones?.forEach(zone => zone.polygon.forEach(move));
  next.lightZones?.forEach(zone => zone.polygonsMm.flat().forEach(move));
  next.lightStrips?.forEach(strip => strip.pathMm.forEach(move));
  next.walkthroughs?.forEach(route => route.waypoints.forEach(point => { move(point); if (point.lookAt) move(point.lookAt); }));
  return next;
}
