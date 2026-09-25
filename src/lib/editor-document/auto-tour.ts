import type { EditorDocument, Point } from './schema';
import { insideRoom } from './ceiling-geometry';
import { distance } from './geometry';
import { wallPath } from './wall-path';
import { waypoint, type WalkthroughPath } from './walkthrough';
import { findWalkablePath, walkthroughNavigation } from './walkthrough-navigation';

export function autoTour(doc: EditorDocument, zoneIds: string[]): WalkthroughPath {
  if (!zoneIds.length) throw new Error('Elige al menos una estancia');
  const nav = walkthroughNavigation(doc, zoneIds), rooms = nav.rooms;
  if (rooms.length !== new Set(zoneIds).size) throw new Error('Las estancias han cambiado. Vuelve a elegirlas.');
  const centers = new Map<string, Point>(), freePoints = new Map<string, Point[]>();
  for (const room of rooms) {
    const xs = room.boundary.map((p) => p.x), ys = room.boundary.map((p) => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, candidates: Point[] = [];
    const grid = Math.max(250, (maxX - minX) / 100, (maxY - minY) / 100);
    for (let x = minX + 200; x < maxX; x += grid) for (let y = minY + 200; y < maxY; y += grid) {
      const p = { x, y }; if (insideRoom(p, room.boundary) && nav.free(p)) candidates.push(p);
    }
    candidates.sort((a, b) => distance(a, center) - distance(b, center));
    if (!candidates[0]) throw new Error('Una estancia no tiene espacio libre suficiente para la cámara');
    centers.set(room.id, candidates[0]); freePoints.set(room.id, candidates);
  }
  const links = new Map(rooms.map((room) => [room.id, new Set<string>()]));
  for (const opening of doc.openings.filter((o) => o.kind !== 'ventana')) {
    const wall = doc.walls.find((w) => w.id === opening.wallId)!;
    const path = wallPath(doc, wall), p = path.at(opening.position), tangent = path.tangent(opening.position);
    const offset = wall.thicknessMm / 2 + 200;
    const a = { x: p.x - tangent.y * offset, y: p.y + tangent.x * offset };
    const b = { x: p.x + tangent.y * offset, y: p.y - tangent.x * offset };
    const from = nav.roomAt(a), to = nav.roomAt(b);
    if (from && to && from.id !== to.id && nav.segmentFree(a, b)) {
      links.get(from.id)!.add(to.id); links.get(to.id)!.add(from.id);
    }
  }
  const first = [...rooms].sort((a, b) => b.areaMm2 - a.areaMm2)[0]!;
  const order = [first.id], seen = new Set(order);
  for (let i = 0; i < order.length; i++) for (const id of links.get(order[i]!)!) if (!seen.has(id)) { seen.add(id); order.push(id); }
  if (order.length !== rooms.length) throw new Error('Las estancias elegidas no están conectadas por puertas transitables. Incluye el pasillo y abre las puertas.');
  const points = [centers.get(first.id)!];
  for (const id of order.slice(1)) {
    let leg: Point[] | undefined;
    // El punto más céntrico puede estar en una bolsa libre pero aislada por
    // muebles. Probar otros puntos de la misma estancia antes de descartar la ruta.
    for (const target of freePoints.get(id)!.slice(0, 60)) {
      try { leg = findWalkablePath(nav, points.at(-1)!, target); break; }
      catch { /* el siguiente candidato puede ser alcanzable */ }
    }
    if (!leg) throw new Error('No hay un paso transitable entre las estancias elegidas. Revisa puertas y muebles.');
    points.push(...leg.slice(1));
  }
  if (points.length === 1) {
    const p = points[0]!;
    const candidates = freePoints.get(first.id)!.sort((a, b) => distance(b, p) - distance(a, p)).slice(0, 12);
    let extension: Point[] | undefined;
    for (const target of candidates) {
      try { extension = findWalkablePath(nav, p, target); break; } catch { /* probar otro punto libre */ }
    }
    if (!extension || distance(p, extension.at(-1)!) < 300) throw new Error('Añade dos puntos manuales en una zona despejada');
    points.push(...extension.slice(1));
  }
  return { id: crypto.randomUUID(), name: 'Recorrido por estancias', zoneIds, loop: false, waypoints: points.map(waypoint) };
}
