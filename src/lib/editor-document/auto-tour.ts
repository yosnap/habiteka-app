import type { EditorDocument, Point } from './schema';
import { insideRoom } from './ceiling-geometry';
import { distance } from './geometry';
import { wallPath } from './wall-path';
import { waypoint, type WalkthroughPath } from './walkthrough';
import { findWalkablePath, walkthroughNavigation } from './walkthrough-navigation';

export interface AutoTourOptions {
  /** Recorre también las estancias sin puerta transitable y omite las que no tienen paso libre, en lugar de fallar. */
  bestEffort?: boolean;
  name?: string;
}

export function autoTour(doc: EditorDocument, zoneIds: string[], options: AutoTourOptions = {}): WalkthroughPath {
  if (!zoneIds.length) throw new Error('Elige al menos una estancia');
  const nav = walkthroughNavigation(doc, zoneIds), allRooms = nav.rooms;
  if (allRooms.length !== new Set(zoneIds).size) throw new Error('Las estancias han cambiado. Vuelve a elegirlas.');
  const rooms = [...allRooms];
  const centers = new Map<string, Point>(), freePoints = new Map<string, Point[]>();
  for (const room of allRooms) {
    const xs = room.boundary.map((p) => p.x), ys = room.boundary.map((p) => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, candidates: Point[] = [];
    const grid = Math.max(250, (maxX - minX) / 100, (maxY - minY) / 100);
    for (let x = minX + 200; x < maxX; x += grid) for (let y = minY + 200; y < maxY; y += grid) {
      const p = { x, y }; if (insideRoom(p, room.boundary) && nav.free(p)) candidates.push(p);
    }
    candidates.sort((a, b) => distance(a, center) - distance(b, center));
    if (!candidates[0]) {
      // En el recorrido completo una estancia llena de muebles se omite en lugar de anular toda la ruta.
      if (options.bestEffort) { rooms.splice(rooms.indexOf(room), 1); continue; }
      throw new Error('Una estancia no tiene espacio libre suficiente para la cámara');
    }
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
    if (from && to && from.id !== to.id && links.has(from.id) && links.has(to.id) && nav.segmentFree(a, b)) {
      links.get(from.id)!.add(to.id); links.get(to.id)!.add(from.id);
    }
  }
  if (!rooms.length) throw new Error('Ninguna estancia tiene espacio libre suficiente para la cámara');
  const first = [...rooms].sort((a, b) => b.areaMm2 - a.areaMm2)[0]!;
  const order = [first.id], seen = new Set(order);
  for (let i = 0; i < order.length; i++) for (const id of links.get(order[i]!)!) if (!seen.has(id)) { seen.add(id); order.push(id); }
  if (order.length !== rooms.length) {
    if (!options.bestEffort) throw new Error('Las estancias elegidas no están conectadas por puertas transitables. Incluye el pasillo y abre las puertas.');
    // Las estancias sin puerta hacia el resto se visitan por cercanía; si no hay paso libre hasta ellas se omiten.
    const pending = rooms.filter((room) => !seen.has(room.id));
    while (pending.length) {
      const last = centers.get(order.at(-1)!)!;
      pending.sort((a, b) => distance(centers.get(a.id)!, last) - distance(centers.get(b.id)!, last));
      order.push(pending.shift()!.id);
    }
  }
  const points = [centers.get(first.id)!], visited = new Set([first.id]);
  for (const id of order.slice(1)) {
    let leg: Point[] | undefined;
    // El punto más céntrico puede estar en una bolsa libre pero aislada por
    // muebles. Probar otros puntos de la misma estancia antes de descartar la ruta.
    for (const target of freePoints.get(id)!.slice(0, 60)) {
      try { leg = findWalkablePath(nav, points.at(-1)!, target); break; }
      catch { /* el siguiente candidato puede ser alcanzable */ }
    }
    if (!leg) {
      if (options.bestEffort) continue;
      throw new Error('No hay un paso transitable entre las estancias elegidas. Revisa puertas y muebles.');
    }
    points.push(...leg.slice(1)); visited.add(id);
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
  // Una estancia que la ruta atraviesa de camino a otra también consta como visitada.
  const crossed = new Set(rooms.filter((room) => points.some((point) => insideRoom(point, room.boundary))).map((room) => room.id));
  return { id: crypto.randomUUID(), name: options.name ?? 'Recorrido por estancias', zoneIds: options.bestEffort ? zoneIds.filter((id) => visited.has(id) || crossed.has(id)) : zoneIds, loop: false, waypoints: points.map(waypoint) };
}
