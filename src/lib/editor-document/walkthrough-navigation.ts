import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorDocument, Point, Ramp } from './schema';
import { deriveRooms } from './rooms';
import { insideRoom, ceilingSurfaces } from './ceiling-geometry';
import { distance, interpolate } from './geometry';
import { furnitureVolumes } from './furniture-volumes';
import { wallPath } from './wall-path';
import { rampParts } from './ramp-route';
import { localToWorld, worldToLocal } from './spatial-properties';
import { stairLayout } from './stair-layout';

export const CAMERA_CLEARANCE_MM = 150;
export interface WalkBlock {
  kind: 'floor-void' | 'outside' | 'ramp-edge' | 'stair-edge' | 'ceiling' | 'wall' | 'closed-door' |
    'window' | 'door-clearance' | 'outdoor' | 'furniture' | 'column' | 'height-step' | 'too-long' | 'stair-link';
  point: Point;
  entityId?: string;
  part?: string;
  deltaMm?: number;
}
/** Construye una vez el entorno de colisión, reutilizado por ruta y auto-tour. */
export function walkthroughNavigation(doc: EditorDocument, zoneIds?: string[], voids?: {
  floor?: Point[][]; ceiling?: Point[][];
}) {
  const rooms = deriveRooms(doc).filter((room) => !zoneIds?.length || zoneIds.includes(room.id)), ceilings = ceilingSurfaces(doc);
  const walls = doc.walls.filter((w) => !w.hidden).map((wall) => ({ wall, path: wallPath(doc, wall),
    doors: doc.openings.filter((o) => o.wallId === wall.id && o.kind !== 'ventana' &&
      (o.kind !== 'puerta' || (o.openAngleDeg ?? 90) >= 75)) }));
  const rampSurfaces = (doc.ramps ?? []).flatMap((ramp) => rampParts(ramp).map((part) => ({ ramp, part })));
  const roomAt = (p: Point) => rooms.find((room) => insideRoom(p, room.boundary));
  const roomFloorAt = (p: Point) => {
    const room = roomAt(p);
    return room ? doc.floorFinishes?.find((finish) => finish.roomId === room.id)?.elevationMm ?? 0 : null;
  };
  const rampLocalAt = (ramp: Ramp, part: ReturnType<typeof rampParts>[number], p: Point) =>
    worldToLocal({ x: part.x, y: part.y, rotation: part.rotation }, worldToLocal(ramp, p));
  const rampHeightAt = (part: ReturnType<typeof rampParts>[number], y: number) =>
    part.elevationMm + (part.kind === 'flight' ? part.riseMm * (1 - y / part.depthMm) : 0);
  const stairSurfaces = (doc.stairs ?? []).map((stair) => {
    const layout = stairLayout(stair);
    return { stair, outline: layout.outline, treads: [...layout.steps, ...layout.landings] };
  });
  const stairAt = (p: Point) => {
    // Los centros interpolados pueden caer a 1e-10 mm del borde común de dos peldaños.
    const epsilon = .01;
    for (const { stair, treads } of stairSurfaces) {
      const local = worldToLocal(stair, p);
      const tread = treads.find((part) => {
        const turnedFlight = stair.kind === 'L' && part.x > 0;
        const corner = stair.kind === 'L' && part.x === 0 && part.y === 0;
        if (turnedFlight) return local.x >= part.x - epsilon && local.x <= part.x + part.widthMm + epsilon &&
          local.y >= part.y + CAMERA_CLEARANCE_MM - epsilon && local.y <= part.y + part.depthMm - CAMERA_CLEARANCE_MM + epsilon;
        if (corner) return local.x >= CAMERA_CLEARANCE_MM - epsilon && local.x <= part.x + part.widthMm + epsilon &&
          local.y >= CAMERA_CLEARANCE_MM - epsilon && local.y <= part.y + part.depthMm + epsilon;
        return local.x >= part.x + CAMERA_CLEARANCE_MM - epsilon && local.x <= part.x + part.widthMm - CAMERA_CLEARANCE_MM + epsilon &&
          local.y >= part.y - epsilon && local.y <= part.y + part.depthMm + epsilon;
      });
      if (tread) return { id: stair.id, floorMm: stair.elevationMm + tread.heightMm,
        riseMm: stair.heightMm / stair.stepCount };
    }
    return null;
  };
  const rampAt = (p: Point) => {
    for (const { ramp, part } of rampSurfaces) {
      const local = rampLocalAt(ramp, part, p);
      if (local.x < 0 || local.x > ramp.widthMm || local.y < 0 || local.y > part.depthMm) continue;
      const height = rampHeightAt(part, local.y);
      if (local.x < CAMERA_CLEARANCE_MM || local.x > ramp.widthMm - CAMERA_CLEARANCE_MM) {
        const sideX = local.x < CAMERA_CLEARANCE_MM ? -1 : ramp.widthMm + 1;
        const adjacent = localToWorld(ramp, localToWorld({ x: part.x, y: part.y,
          rotation: part.rotation, widthMm: ramp.widthMm, depthMm: part.depthMm }, { x: sideX, y: local.y }));
        const supported = [roomFloorAt(adjacent), ...rampSurfaces.filter((surface) =>
          surface.ramp !== ramp || surface.part !== part).map((surface) => {
          const other = rampLocalAt(surface.ramp, surface.part, adjacent);
          return other.x >= 0 && other.x <= surface.ramp.widthMm && other.y >= 0 &&
            other.y <= surface.part.depthMm ? rampHeightAt(surface.part, other.y) : null;
        })].some((candidate) => candidate !== null && Math.abs(candidate - height) <= 30);
        if (!supported) continue;
      }
      return height;
    }
    return null;
  };
  const outdoor = planObjects(doc).filter((item) => item.catalogId?.startsWith('habiteka:outdoor:')).map((item) => ({ item, volumes: furnitureVolumes(item) }));
  const obstacles = [
    ...planObjects(doc).filter((item) => !item.catalogId?.startsWith('habiteka:outdoor:'))
      .map((item) => ({ item, kind: 'furniture' as const })),
    ...(doc.columns ?? []).map((item) => ({ item, kind: 'column' as const })),
  ];
  const floorAt = (p: Point) => stairAt(p)?.floorMm ?? rampAt(p) ??
    roomFloorAt(p) ?? 0;
  const blockAt = (p: Point, eyeHeightMm = 1600): WalkBlock | null => {
    if (voids?.floor?.some((outline) => insideRoom(p, outline))) return { kind: 'floor-void', point: p };
    const room = roomAt(p);
    // Los umbrales de puerta pueden coincidir exactamente con el borde de dos estancias.
    if (!room && rampAt(p) === null && stairAt(p) === null &&
      !rooms.some((r) => insideRoom({ x: p.x + 1, y: p.y + 1 }, r.boundary))) {
      const edge = rampSurfaces.find(({ ramp, part }) => {
        const local = rampLocalAt(ramp, part, p);
        return local.x >= 0 && local.x <= ramp.widthMm && local.y >= 0 && local.y <= part.depthMm;
      });
      return { kind: edge ? 'ramp-edge' : 'outside', point: p, entityId: edge?.ramp.id };
    }
    // La franja sin apoyo junto al borde de la escalera coincide con sus barandillas 3D.
    if (!stairAt(p)) {
      const edge = stairSurfaces.find(({ stair, outline }) => insideRoom(worldToLocal(stair, p), outline));
      if (edge) return { kind: 'stair-edge', point: p, entityId: edge.stair.id };
    }
    const floor = floorAt(p);
    const roof = ceilings.find((c) => c.room.id === room?.id)?.heightMm;
    if (roof !== undefined && floor + eyeHeightMm + 100 > roof &&
      !voids?.ceiling?.some((outline) => insideRoom(p, outline))) return { kind: 'ceiling', point: p,
        entityId: room?.id, deltaMm: floor + eyeHeightMm + 100 - roof };
    for (const { wall, path, doors } of walls) {
      const t = path.project(p);
      if (distance(p, path.at(t)) >= wall.thicknessMm / 2 + CAMERA_CLEARANCE_MM) continue;
      const opening = doors.find((o) => Math.abs(t - o.position) * path.length <= o.widthMm / 2 - CAMERA_CLEARANCE_MM &&
        (o.elevationMm ?? 0) <= floor + 50 && (o.elevationMm ?? 0) + (o.heightMm ?? 2100) >= floor + eyeHeightMm + 100);
      if (!opening) {
        const nearby = doc.openings.find((o) => o.wallId === wall.id &&
          Math.abs(t - o.position) * path.length <= o.widthMm / 2 - CAMERA_CLEARANCE_MM);
        return { kind: nearby?.kind === 'ventana' ? 'window' : nearby?.kind === 'puerta' &&
          (nearby.openAngleDeg ?? 90) < 75 ? 'closed-door' : nearby ? 'door-clearance' : 'wall',
        point: p, entityId: nearby?.id ?? wall.id };
      }
    }
    for (const { item, volumes } of outdoor) {
      const angle = -item.rotation * Math.PI / 180, dx = p.x - item.x, dy = p.y - item.y;
      const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
      const partIndex = volumes.findIndex((v) => {
        const a = -(v.rotation ?? 0) * Math.PI / 180, dx = x - v.x, dy = y - v.y;
        const vx = dx * Math.cos(a) - dy * Math.sin(a), vy = dx * Math.sin(a) + dy * Math.cos(a);
        return v.top > floor + 100 && v.bottom < floor + eyeHeightMm + 100 &&
          vx > -CAMERA_CLEARANCE_MM && vx < v.widthMm + CAMERA_CLEARANCE_MM &&
          vy > -CAMERA_CLEARANCE_MM && vy < v.depthMm + CAMERA_CLEARANCE_MM;
      });
      if (partIndex >= 0) return { kind: 'outdoor', point: p, entityId: item.id,
        part: item.kind === 'carpa' ? volumes[partIndex]!.walkthroughPart ?? 'poste' : undefined };
    }
    for (const { item, kind } of obstacles) {
      const angle = -item.rotation * Math.PI / 180, dx = p.x - item.x, dy = p.y - item.y;
      const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (x > -CAMERA_CLEARANCE_MM && x < item.widthMm + CAMERA_CLEARANCE_MM &&
        y > -CAMERA_CLEARANCE_MM && y < item.depthMm + CAMERA_CLEARANCE_MM)
        return { kind, point: p, entityId: item.id };
    }
    return null;
  };
  const free = (p: Point, eyeHeightMm = 1600): boolean => !blockAt(p, eyeHeightMm);
  const segmentBlock = (a: Point, b: Point, eyeHeightMm = 1600): WalkBlock | null => {
    // Un mueble puede dejar una franja prohibida muy estrecha en un tramo
    // oblicuo. Muestrear por debajo de esa franja evita aprobar falsos pasos.
    const count = Math.max(1, Math.ceil(distance(a, b) / 10));
    if (count > 10000) return { kind: 'too-long', point: a };
    let previousFloor = floorAt(a);
    let previousStair = stairAt(a);
    for (let i = 0; i <= count; i++) {
      const p = interpolate(a, b, i / count), floor = floorAt(p), stair = stairAt(p);
      const rise = stair?.id === previousStair?.id ? stair?.riseMm
        : stair?.riseMm ?? previousStair?.riseMm;
      const allowedStep = rise !== undefined && rise <= 220 && Math.abs(floor - previousFloor) <= rise + 1;
      const blocked = blockAt(p, eyeHeightMm);
      if (blocked) return blocked;
      if (Math.abs(floor - previousFloor) > 30 && !allowedStep)
        return { kind: 'height-step', point: p, deltaMm: Math.abs(floor - previousFloor) };
      previousFloor = floor; previousStair = stair;
    }
    return null;
  };
  const segmentFree = (a: Point, b: Point, eyeHeightMm = 1600) => !segmentBlock(a, b, eyeHeightMm);
  return { rooms, free, blockAt, segmentFree, segmentBlock, floorAt, roomAt };
}

/** A* ortogonal acotado; simplificación por visibilidad conserva pasos de puerta. */
export function findWalkablePath(nav: ReturnType<typeof walkthroughNavigation>, from: Point, to: Point): Point[] {
  if (nav.segmentFree(from, to)) return [from, to];
  const all = nav.rooms.flatMap((r) => r.boundary), step = 100;
  const minX = Math.min(...all.map((p) => p.x)), minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x)), maxY = Math.max(...all.map((p) => p.y));
  const key = (p: Point) => `${Math.round((p.x - minX) / step)},${Math.round((p.y - minY) / step)}`;
  const point = (id: string) => { const [x, y] = id.split(',').map(Number); return { x: minX + x! * step, y: minY + y! * step }; };
  const start = key(from), open = new Set([start]), costs = new Map([[start, 0]]), parents = new Map<string, string>();
  if (!nav.segmentFree(from, point(start))) throw new Error('No hay espacio libre junto al punto inicial');
  const freeCache = new Map<string, boolean>();
  let end: string | undefined;
  for (let iterations = 0; open.size && iterations < 30000; iterations++) {
    let current = '', score = Infinity;
    for (const id of open) { const next = costs.get(id)! + distance(point(id), to); if (next < score) { current = id; score = next; } }
    const p = point(current); open.delete(current);
    if (distance(p, to) < step * 2 && nav.segmentFree(p, to)) { end = current; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = { x: p.x + dx! * step, y: p.y + dy! * step };
      if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) continue;
      const id = key(q), cost = costs.get(current)! + step;
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      if (!freeCache.has(id)) freeCache.set(id, nav.free(q));
      if (!freeCache.get(id) || !nav.segmentFree(p, q)) continue;
      costs.set(id, cost); parents.set(id, current); open.add(id);
    }
  }
  if (!end) throw new Error('No hay un paso transitable entre las estancias elegidas. Revisa puertas y muebles.');
  const points: Point[] = [to];
  for (let id: string | undefined = end; id; id = parents.get(id)) points.unshift(point(id));
  points.unshift(from);
  const simplified = [from];
  for (let index = 0; index < points.length - 1;) {
    let next = points.length - 1;
    while (next > index + 1 && !nav.segmentFree(points[index]!, points[next]!)) next--;
    simplified.push(points[next]!); index = next;
  }
  return simplified;
}
