/**
 * Geometría de las tiras LED: recorrido derivado del contorno de la estancia,
 * incidencias de colocación y resolución final (lo que ven 2D, 3D e IA).
 *
 * La regla de oro: una tira `derived` recalcula SIEMPRE su recorrido a partir
 * de la geometría de origen (sigue al muro), y una tira editada a mano usa su
 * `pathMm` tal cual. La instantánea guardada en `pathMm` de las derivadas es
 * solo eso, una instantánea para que el fichero guardado sea coherente.
 */
import type { EditorDocument, LightStrip, Point } from './schema';
import { ceilingSurfaces, insideRoom, type CeilingSurface } from './ceiling-geometry';
import { deriveRoomsSafe, type DerivedRoom } from './rooms';
import { floorFinish } from './floor-finishes';
import { limitPolygonVertices, pointInPolygon, polygonSelfIntersects } from './polygon-tools';
import { MAX_STRIP_POINTS, MIN_STRIP_POINTS, MIN_STRIP_SEGMENT_MM, stripLengthMm } from './light-strip-types';
import type { KitchenRun } from './kitchen-run-types';
import { localToWorld, objectCenter, worldToLocal } from './spatial-properties';
// Ciclo de módulos tolerado: solo se usa dentro de funciones, nunca al cargar.
import { activeSceneForRoom, effectiveStrip } from './lighting-scene';

/** Retranqueo del foseado hacia el interior de la estancia. */
export const COVE_INSET_MM = 150;
/** Distancia por debajo de la cual un tramo libre se considera adosado a un muro. */
export const STRIP_WALL_GRIP_MM = 300;
/** Recorrido mínimo para que una tira ilumine algo. */
export const MIN_FREE_STRIP_LENGTH_MM = 300;
/** Holgura que la tira libre deja bajo el techo de su estancia. */
export const FREE_STRIP_HEADROOM_MM = 50;

export interface ResolvedStrip {
  strip: LightStrip;
  /** Recorrido resuelto en coordenadas del plano. */
  pathMm: Point[];
  /** Cota del emisor sobre el suelo de la planta (incluye el acabado del suelo). */
  elevationMm: number;
  direction: 'up' | 'down' | 'out';
  lengthMm: number;
  /** Estancia a la que pertenece; null si no cae en ninguna (solo tiras a mano). */
  roomId: string | null;
  /** Dirección horizontal del haz cuando `direction === 'out'`, en ejes del plano. */
  normal?: Point;
  lumens: number;
  /**
   * Valores que mandan en 2D, 3D e IA: los nominales de la tira, o los de la
   * escena activa de su estancia. Los campos de `strip` no cambian.
   */
  effectiveTemperatureK: number;
  effectiveLumensPerMeter: number;
  effectiveLumens: number;
  effectiveEnabled: boolean;
}

/** Orientación del contorno: positiva o negativa según el sentido de sus vértices. */
function signedArea(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
}

/** Normal unitaria que apunta hacia el interior del contorno desde el lado a-b. */
export function inwardNormal(a: Point, b: Point, polygon: readonly Point[]): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
  const sign = signedArea(polygon) > 0 ? 1 : -1;
  return { x: -dy * sign, y: dx * sign };
}

/**
 * Contorno retranqueado hacia dentro. Devuelve null cuando el retranqueo se
 * come la estancia (autointersección o vértices fuera): mejor una incidencia
 * clara que un recorrido roto.
 */
export function insetPolygon(polygon: readonly Point[], insetMm: number): Point[] | null {
  if (polygon.length < 3) return null;
  const lines = polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length]!;
    const normal = inwardNormal(a, b, polygon);
    return { point: { x: a.x + normal.x * insetMm, y: a.y + normal.y * insetMm }, dir: { x: b.x - a.x, y: b.y - a.y } };
  });
  const result: Point[] = [];
  for (let i = 0; i < lines.length; i++) {
    const previous = lines[(i - 1 + lines.length) % lines.length]!, current = lines[i]!;
    const cross = previous.dir.x * current.dir.y - previous.dir.y * current.dir.x;
    if (Math.abs(cross) < 1e-9) { result.push(current.point); continue; }
    const t = ((current.point.x - previous.point.x) * current.dir.y - (current.point.y - previous.point.y) * current.dir.x) / cross;
    result.push({ x: previous.point.x + previous.dir.x * t, y: previous.point.y + previous.dir.y * t });
  }
  if (result.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  if (result.some((point) => !pointInPolygon(point, polygon))) return null;
  if (polygonSelfIntersects(result)) return null;
  if (signedArea(result) * signedArea(polygon) <= 0) return null;
  return result;
}

/** El recorrido del foseado es un anillo cerrado: el primer punto se repite al final. */
export function coveRing(boundary: readonly Point[], insetMm = COVE_INSET_MM): Point[] | null {
  const inset = insetPolygon(limitPolygonVertices(boundary, 12), insetMm);
  if (!inset) return null;
  const ring = [...inset, inset[0]!];
  return ring.every((point, index) => index === 0 ||
    Math.hypot(point.x - ring[index - 1]!.x, point.y - ring[index - 1]!.y) >= MIN_STRIP_SEGMENT_MM) ? ring : null;
}

/** Separación de la tira respecto al frente de los módulos altos, para que no se vea desde delante. */
export const UNDER_CABINET_FRONT_INSET_MM = 30;
/** Lo que la tira se retira de cada extremo del tramo. */
export const UNDER_CABINET_END_INSET_MM = 50;
/** Caída de la tira bajo la cara inferior de los altos; evita el z-fighting con el mueble. */
export const UNDER_CABINET_DROP_MM = 10;

/** Tramo de cocina al que se ancla una tira bajo módulos altos, o undefined. */
export function stripKitchenRun(doc: EditorDocument, strip: LightStrip): KitchenRun | undefined {
  return strip.kind === 'under-cabinet'
    ? doc.kitchenRuns?.find((run) => run.id === strip.kitchenRunId) : undefined;
}

/**
 * Recorrido de la tira bajo los módulos altos de un tramo: paralelo a la línea
 * trasera, dentro del fondo de los altos y sin llegar a los extremos. Se
 * calcula en el sistema local del tramo (x a lo largo, y hacia el fondo), así
 * que girar o mover el mueble arrastra la tira sin más.
 */
export function underCabinetPath(run: KitchenRun): Point[] | null {
  const uppers = run.kitchen.uppers;
  if (!uppers) return null;
  const depth = uppers.depthMm - UNDER_CABINET_FRONT_INSET_MM;
  const from = UNDER_CABINET_END_INSET_MM, to = run.widthMm - UNDER_CABINET_END_INSET_MM;
  if (depth <= 0 || to - from < MIN_STRIP_SEGMENT_MM) return null;
  return [localToWorld(run, { x: from, y: depth }), localToWorld(run, { x: to, y: depth })];
}

/** Cota de la tira sobre el suelo acabado de su estancia, según los altos del tramo. */
export function underCabinetElevationMm(run: KitchenRun): number {
  return Math.max(0, (run.kitchen.uppers?.bottomMm ?? 0) - UNDER_CABINET_DROP_MM);
}

/** Un punto del plano queda bajo los módulos altos del tramo. */
function underUppers(run: KitchenRun, point: Point): boolean {
  const uppers = run.kitchen.uppers;
  if (!uppers) return false;
  const local = worldToLocal(run, point);
  return local.x >= 0 && local.x <= run.widthMm && local.y >= 0 && local.y <= uppers.depthMm;
}

/** Estancia que contiene todos los puntos del recorrido, o null. */
function roomOfPath(rooms: readonly DerivedRoom[], path: readonly Point[]): DerivedRoom | null {
  return rooms.find((room) => path.every((point) => insideRoom(point, room.boundary))) ?? null;
}

/**
 * Recorrido que la tira debería seguir según la geometría de origen. Devuelve
 * null cuando esa geometría ya no está o no admite la tira.
 */
export function derivedStripPath(doc: EditorDocument, strip: LightStrip, surfaces = ceilingSurfaces(doc)): Point[] | null {
  if (strip.kind === 'under-cabinet') {
    const run = stripKitchenRun(doc, strip);
    return run ? underCabinetPath(run) : null;
  }
  if (strip.kind !== 'cove') return null;
  const surface = surfaces.find((item) => item.ceiling.id === strip.ceilingId);
  if (!surface || surface.ceiling.kind !== 'suspended' || surface.ceiling.dropMm < 80) return null;
  return coveRing(surface.room.boundary);
}

/**
 * Refresca la instantánea `pathMm` de las tiras derivadas; nunca toca las
 * editadas a mano. Lo usan los comandos de tiras y los del mueble de cocina,
 * para que el fichero guardado cuente lo mismo que el 2D y el 3D.
 */
export function refreshDerivedStripPaths(doc: EditorDocument): EditorDocument {
  if (!doc.lightStrips?.length) return doc;
  const surfaces = ceilingSurfaces(doc);
  for (const strip of doc.lightStrips) {
    if (!strip.derived) continue;
    const path = derivedStripPath(doc, strip, surfaces);
    if (path && path.length >= MIN_STRIP_POINTS && path.length <= MAX_STRIP_POINTS) strip.pathMm = path;
  }
  return doc;
}

/** Altura libre de la estancia de un techo, medida desde su suelo acabado. */
function clearanceMm(doc: EditorDocument, surface: CeilingSurface): number {
  return surface.heightMm - (floorFinish(doc, surface.room.id).elevationMm ?? 0);
}

/** Motivo por el que una tira no se puede dibujar, o null si está bien colocada. */
export function lightStripIssue(
  doc: EditorDocument,
  strip: LightStrip,
  surfaces = ceilingSurfaces(doc),
  rooms = deriveRoomsSafe(doc),
): string | null {
  if (strip.kind === 'cove') {
    const surface = surfaces.find((item) => item.ceiling.id === strip.ceilingId);
    if (!surface) return 'El techo del foseado requiere revisar su estancia o altura';
    if (surface.ceiling.kind !== 'suspended' || surface.ceiling.dropMm < 80)
      return 'El foseado necesita un falso techo con al menos 8 cm de descenso';
    if (strip.derived) {
      if (!coveRing(surface.room.boundary)) return 'La estancia es demasiado estrecha para un foseado';
      return null;
    }
    return strip.pathMm.every((point) => insideRoom(point, surface.room.boundary))
      ? null : 'El foseado ajustado a mano se sale de la estancia; reajústalo al contorno';
  }
  if (strip.kind === 'under-cabinet') {
    const run = stripKitchenRun(doc, strip);
    if (!run) return 'El tramo de cocina ya no existe';
    if (!run.kitchen.uppers) return 'El tramo de cocina no tiene módulos altos';
    if (!underCabinetPath(run)) return 'El tramo de cocina es demasiado corto para una tira bajo los módulos altos';
    if (strip.derived) return null;
    return strip.pathMm.every((point) => underUppers(run, point))
      ? null : 'La tira ajustada a mano ya no queda bajo el mueble; reajústala';
  }
  if (stripLengthMm(strip.pathMm) < MIN_FREE_STRIP_LENGTH_MM)
    return `El tramo libre necesita al menos ${MIN_FREE_STRIP_LENGTH_MM} mm de recorrido`;
  const room = roomOfPath(rooms, strip.pathMm);
  if (!room) return 'El tramo libre debe quedar dentro de una estancia';
  const surface = surfaces.find((item) => item.room.id === room.id);
  if (surface && strip.elevationMm > clearanceMm(doc, surface) - FREE_STRIP_HEADROOM_MM)
    return 'Baja la cota del tramo libre: no cabe bajo el techo de la estancia';
  return null;
}

/** Dirección del haz y, si procede, hacia dónde se aleja del muro al que está adosado. */
function freeStripAim(path: readonly Point[], room: DerivedRoom | null): Pick<ResolvedStrip, 'direction' | 'normal'> {
  if (!room) return { direction: 'down' };
  const middle = path[Math.floor(path.length / 2)]!;
  let best: { distance: number; normal: Point } | null = null;
  for (let i = 0; i < room.boundary.length; i++) {
    const a = room.boundary[i]!, b = room.boundary[(i + 1) % room.boundary.length]!;
    const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((middle.x - a.x) * (b.x - a.x) + (middle.y - a.y) * (b.y - a.y)) / lengthSq));
    const distance = Math.hypot(middle.x - a.x - (b.x - a.x) * t, middle.y - a.y - (b.y - a.y) * t);
    if (!best || distance < best.distance) best = { distance, normal: inwardNormal(a, b, room.boundary) };
  }
  return best && best.distance <= STRIP_WALL_GRIP_MM ? { direction: 'out', normal: best.normal } : { direction: 'down' };
}

/** Tiras que se pueden dibujar, con su recorrido ya resuelto. Las que tienen incidencia se omiten. */
export function resolvedStrips(doc: EditorDocument): ResolvedStrip[] {
  if (!doc.lightStrips?.length) return [];
  const surfaces = ceilingSurfaces(doc), rooms = deriveRoomsSafe(doc);
  return doc.lightStrips.flatMap((strip) => {
    if (lightStripIssue(doc, strip, surfaces, rooms)) return [];
    const pathMm = strip.derived ? derivedStripPath(doc, strip, surfaces) : strip.pathMm;
    if (!pathMm || pathMm.length < 2) return [];
    const surface = strip.kind === 'cove' ? surfaces.find((item) => item.ceiling.id === strip.ceilingId) : undefined;
    const room = surface?.room ?? roomOfPath(rooms, pathMm);
    const floor = room ? floorFinish(doc, room.id).elevationMm ?? 0 : 0;
    const lengthMm = stripLengthMm(pathMm);
    const effective = effectiveStrip(strip, activeSceneForRoom(doc, room?.id));
    return [{
      strip, pathMm, lengthMm, roomId: room?.id ?? null,
      elevationMm: floor + strip.elevationMm,
      lumens: (lengthMm / 1000) * strip.lumensPerMeter,
      effectiveTemperatureK: effective.temperatureK,
      effectiveLumensPerMeter: effective.lumensPerMeter,
      effectiveLumens: (lengthMm / 1000) * effective.lumensPerMeter,
      effectiveEnabled: effective.enabled,
      // La tira de cocina siempre ilumina la encimera; el foseado, el techo.
      ...(strip.kind === 'cove' ? { direction: 'up' as const }
        : strip.kind === 'under-cabinet' ? { direction: 'down' as const } : freeStripAim(pathMm, room)),
    }];
  });
}

/**
 * Estancia a la que pertenece una tira aunque tenga incidencias: el foseado va
 * con su techo, la tira de cocina con la estancia de su mueble y el tramo
 * libre, con la estancia que lo contiene.
 */
export function stripRoomId(doc: EditorDocument, strip: LightStrip, surfaces = ceilingSurfaces(doc), rooms = deriveRoomsSafe(doc)): string | null {
  if (strip.kind === 'cove')
    return surfaces.find((item) => item.ceiling.id === strip.ceilingId)?.room.id
      ?? doc.ceilings?.find((item) => item.id === strip.ceilingId)?.roomId ?? null;
  const run = stripKitchenRun(doc, strip);
  // La tira de cocina va con la estancia del mueble aunque su recorrido se haya retocado.
  if (run) return rooms.find((room) => insideRoom(objectCenter(run), room.boundary))?.id ?? null;
  return roomOfPath(rooms, strip.pathMm)?.id ?? null;
}

/** Avisos de las tiras, con el mismo formato que el resto de incidencias del techo. */
export function lightStripIssues(doc: EditorDocument): { id: string; label: string; message: string }[] {
  if (!doc.lightStrips?.length) return [];
  const surfaces = ceilingSurfaces(doc), rooms = deriveRoomsSafe(doc);
  return doc.lightStrips.flatMap((strip, index) => {
    const issue = lightStripIssue(doc, strip, surfaces, rooms);
    return issue ? [{ id: strip.id, label: `Tira LED ${index + 1}`, message: issue }] : [];
  });
}
