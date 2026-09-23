/**
 * Acotado y recorte del contexto del prompt compacto.
 *
 * Existe porque los modelos de imagen de KIE (`flux-2/*`) rechazan prompts de
 * más de 5000 caracteres, y una vista interior de un plano real se iba por
 * encima de 7000 al llevar TODA la planta. En una vista interior la cámara solo
 * ve su estancia y lo que se asoma por sus huecos, así que el resto de la
 * planta es contexto inútil que paga cuota. Si aun así no cabe, se degrada por
 * prioridad explícita: nunca se corta el JSON a mitad ni se quitan las
 * restricciones duras del texto de política.
 */

/** Tope con el que se construye el compacto: 200 caracteres de margen sobre el límite duro de 5000. */
import { simplifyPolygon } from '@/lib/editor-document/polygon-tools';

export const COMPACT_PROMPT_LIMIT = 4800;

export interface ScopePoint {
  x: number;
  y: number;
}
export interface ScopeRoom {
  id: string;
  areaM2: number;
  boundaryM: ScopePoint[];
}
export interface ScopeFloor {
  [key: string]: unknown;
  roomId: string;
  finishedFloorElevationM: number;
  structuralDepthM: number;
  undersideElevationM: number;
}
export interface ScopeWall {
  [key: string]: unknown;
  id: string;
  name: string | null;
  hidden: boolean;
  lengthM: number;
  thicknessM: number;
  heightM: number;
  baseElevationM: number;
  pathM: ScopePoint[];
}
export interface ScopeOpening {
  [key: string]: unknown;
  id: string;
  name: string | null;
  wallId: string;
  kind: string;
  position: number;
  widthM: number;
  heightM: number;
  elevationM: number;
}
export interface ScopePlaced {
  [key: string]: unknown;
  id: string;
  name?: string | null;
  positionM: { x: number; y: number; elevation: number };
}
export interface ScopeRamp {
  [key: string]: unknown;
  id: string;
  parts: { footprintM: ScopePoint[] }[];
}
export interface ScopeRoomBound {
  [key: string]: unknown;
  id: string;
  roomId: string;
}
export interface ScopeLevel {
  id: string;
  elevationM: number;
  rooms: ScopeRoom[];
  floors: ScopeFloor[];
  ceilings: ScopeRoomBound[];
  luminaires: ScopeRoomBound[];
  walls: ScopeWall[];
  openings: ScopeOpening[];
  columns: ScopePlaced[];
  stairs: ScopePlaced[];
  ramps: ScopeRamp[];
  furniture: ScopePlaced[];
}
export interface ScopePayload {
  camera: unknown;
  designOptions: unknown;
  levels: ScopeLevel[];
}

/**
 * Muros que forman el contorno de una estancia. El id de estancia los enumera
 * por construcción (`room:["w1","w2",…]`, ver `deriveRooms`), así que no hace
 * falta volver a derivar la topología para saberlo.
 */
export function roomWallIds(roomId: string): string[] {
  if (!roomId.startsWith('room:')) return [];
  try {
    const parsed: unknown = JSON.parse(roomId.slice(5));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** La estancia de la cámara y las que comparten muro con ella: lo que se ve por sus huecos. */
export function scopedRoomIds(rooms: readonly ScopeRoom[], roomId: string): string[] {
  const walls = new Set(roomWallIds(roomId));
  if (!walls.size) return rooms.map((room) => room.id);
  const scoped = rooms
    .filter((room) => room.id === roomId || roomWallIds(room.id).some((id) => walls.has(id)))
    .map((room) => room.id);
  return scoped.includes(roomId) ? scoped : [roomId, ...scoped];
}

function boundsOf(rooms: readonly ScopeRoom[]) {
  const points = rooms.flatMap((room) => room.boundaryM);
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  // Un metro de margen: un mueble pegado por fuera del muro sigue siendo visible por un hueco.
  return {
    minX: Math.min(...xs) - 1,
    maxX: Math.max(...xs) + 1,
    minY: Math.min(...ys) - 1,
    maxY: Math.max(...ys) + 1,
  };
}

const withinPoint = (point: ScopePoint, bounds: ReturnType<typeof boundsOf>): boolean =>
  !bounds ||
  (point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY);

const withinBounds = (item: ScopePlaced, bounds: ReturnType<typeof boundsOf>): boolean =>
  withinPoint({ x: item.positionM.x, y: item.positionM.y }, bounds);

/** Deja de cada planta solo las estancias indicadas y lo que les pertenece o cae sobre ellas. */
export function scopeLevelToRooms(level: ScopeLevel, roomIds: readonly string[]): ScopeLevel {
  const keep = new Set(roomIds);
  const rooms = level.rooms.filter((room) => keep.has(room.id));
  if (!rooms.length) return level;
  const wallIds = new Set(roomIds.flatMap(roomWallIds));
  const bounds = boundsOf(rooms);
  return {
    ...level,
    rooms,
    floors: level.floors.filter((floor) => keep.has(floor.roomId)),
    ceilings: level.ceilings.filter((ceiling) => keep.has(ceiling.roomId)),
    luminaires: level.luminaires.filter((luminaire) => keep.has(luminaire.roomId)),
    walls: level.walls.filter((wall) => wallIds.has(wall.id)),
    openings: level.openings.filter((opening) => wallIds.has(opening.wallId)),
    columns: level.columns.filter((item) => withinBounds(item, bounds)),
    stairs: level.stairs.filter((item) => withinBounds(item, bounds)),
    ramps: level.ramps.filter((ramp) =>
      ramp.parts.some((part) => part.footprintM.some((point) => withinPoint(point, bounds))),
    ),
    furniture: level.furniture.filter((item) => withinBounds(item, bounds)),
  };
}

/** Acota todas las plantas del contexto a la estancia de la cámara y sus vecinas. */
export function scopeInteriorPayload(payload: ScopePayload, roomId: string | null): ScopePayload {
  if (!roomId) return payload;
  return {
    ...payload,
    levels: payload.levels.map((level) =>
      level.rooms.some((room) => room.id === roomId)
        ? scopeLevelToRooms(level, scopedRoomIds(level.rooms, roomId))
        : level,
    ),
  };
}

/** Redondeo de todas las cotas a `decimals`: conserva la geometría, no su ruido decimal. */
export function roundPayload<T>(value: T, decimals: number): T {
  const factor = 10 ** decimals;
  const walk = (item: unknown): unknown => {
    if (typeof item === 'number') return Math.round(item * factor) / factor;
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object')
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)]));
    return item;
  };
  return walk(value) as T;
}

/** Quita los nombres de muros y huecos: son datos del editor, no restricciones del render. */
function withoutNames(payload: ScopePayload): ScopePayload {
  return {
    ...payload,
    levels: payload.levels.map((level) => ({
      ...level,
      walls: level.walls.map((wall) => ({ ...wall, name: null })),
      openings: level.openings.map((opening) => ({ ...opening, name: null })),
    })),
  };
}

/** Deja solo la estancia de la cámara: último recurso antes de quedarnos sin contexto. */
function onlyCameraRoom(payload: ScopePayload, roomId: string | null): ScopePayload {
  if (!roomId) return payload;
  return {
    ...payload,
    levels: payload.levels.map((level) =>
      level.rooms.some((room) => room.id === roomId) ? scopeLevelToRooms(level, [roomId]) : level,
    ),
  };
}

/** Cota de forjado: derivable del suelo acabado, es lo primero que sobra en una vista interior. */
function withoutSlabDetail(payload: ScopePayload): ScopePayload {
  return {
    ...payload,
    levels: payload.levels.map((level) => ({
      ...level,
      floors: level.floors.map((floor) => ({
        roomId: floor.roomId,
        finishedFloorElevationM: floor.finishedFloorElevationM,
        structuralDepthM: 0,
        undersideElevationM: 0,
      })),
    })),
  };
}

/**
 * Geometría esencial: se quitan los campos derivables (longitud de muro) o de
 * mera identificación del editor (nombres, ids de hueco) y se conservan todas
 * las medidas que el render no puede cambiar.
 */
function essentialGeometry(payload: ScopePayload, boundaryTolerance = 0): unknown {
  return {
    ...payload,
    levels: payload.levels.map((level) => ({
      ...level,
      rooms: level.rooms.map((room) => ({
        id: room.id,
        areaM2: room.areaM2,
        boundaryM: boundaryTolerance
          ? simplifyPolygon(room.boundaryM, boundaryTolerance)
          : room.boundaryM,
      })),
      walls: level.walls.map((wall) => ({
        id: wall.id,
        thicknessM: wall.thicknessM,
        heightM: wall.heightM,
        baseElevationM: wall.baseElevationM,
        pathM: wall.pathM,
      })),
      openings: level.openings.map((opening) => ({
        wallId: opening.wallId,
        kind: opening.kind,
        position: opening.position,
        widthM: opening.widthM,
        heightM: opening.heightM,
        elevationM: opening.elevationM,
      })),
    })),
  };
}

/**
 * Los ids de estancia enumeran sus muros (`room:["w1","w2",…]`) y se repiten en
 * suelos, techos y luces: en el texto se sustituyen por `r0`, `r1`… Sin pérdida,
 * porque solo sirven para relacionar entradas del propio contexto.
 */
export function aliasRoomIds<T>(value: T): T {
  const payload = value as { levels?: Record<string, unknown>[] } | null;
  if (!payload || !Array.isArray(payload.levels)) return value;
  const alias = new Map<string, string>();
  const short = (id: unknown) => {
    if (typeof id !== 'string') return id;
    if (!alias.has(id)) alias.set(id, `r${alias.size}`);
    return alias.get(id);
  };
  const remap = (list: unknown, key: 'id' | 'roomId') => Array.isArray(list)
    ? list.map((item: Record<string, unknown>) => ({ ...item, [key]: short(item[key]) })) : list;
  return {
    ...payload,
    levels: payload.levels.map((level) => ({
      ...level,
      rooms: remap(level.rooms, 'id'),
      floors: remap(level.floors, 'roomId'),
      ceilings: remap(level.ceilings, 'roomId'),
      luminaires: remap(level.luminaires, 'roomId'),
    })),
  } as T;
}

/**
 * Valores que casi siempre coinciden en toda una planta (grosor, altura y cota
 * de los muros; tipo, altura, descenso y color de los techos; cotas de los
 * suelos) se escriben una vez en `wallDefaults` / `ceilingDefaults` /
 * `floorDefaults` y cada elemento solo los lleva si
 * difiere. Sin pérdida; se usa en vistas exteriores, que llevan la planta entera.
 */
const SHARED_DEFAULTS = [
  { list: 'walls', target: 'wallDefaults', keys: ['thicknessM', 'heightM', 'baseElevationM'] },
  { list: 'ceilings', target: 'ceilingDefaults', keys: ['kind', 'heightM', 'dropM', 'color'] },
  { list: 'floors', target: 'floorDefaults', keys: ['finishedFloorElevationM', 'structuralDepthM', 'undersideElevationM'] },
] as const;

function hoistShared(level: Record<string, unknown>, list: string, target: string, keys: readonly string[]): Record<string, unknown> {
  const items = Array.isArray(level[list]) ? level[list] as Record<string, unknown>[] : [];
  const signature = (item: Record<string, unknown>) => keys.map((key) => JSON.stringify(item[key] ?? null)).join('|');
  const counts = new Map<string, number>();
  for (const item of items) counts.set(signature(item), (counts.get(signature(item)) ?? 0) + 1);
  const [common, uses] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!common || !uses || uses < 2) return level;
  const sample = items.find((item) => signature(item) === common)!;
  return {
    ...level,
    [target]: Object.fromEntries(keys.map((key) => [key, sample[key]])),
    [list]: items.map((item) => signature(item) === common
      ? Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)))
      : item),
  };
}

export function hoistSharedDefaults<T>(value: T): T {
  const payload = value as { levels?: Record<string, unknown>[] } | null;
  if (!payload || !Array.isArray(payload.levels)) return value;
  return {
    ...payload,
    levels: payload.levels.map((level) =>
      SHARED_DEFAULTS.reduce((current, rule) => hoistShared(current, rule.list, rule.target, rule.keys), level)),
  } as T;
}

/**
 * Vista exterior: el contorno de cada estancia (y el de su techo, que es el
 * mismo) se deduce de los muros; queda el id, el área y los datos del techo.
 */
function withoutRoomBoundaries(payload: ScopePayload): ScopePayload {
  return {
    ...payload,
    levels: payload.levels.map((level) => ({
      ...level,
      rooms: level.rooms.map((room) => ({ id: room.id, areaM2: room.areaM2, boundaryM: [] })),
      ceilings: level.ceilings.map((ceiling) => Object.fromEntries(Object.entries(ceiling).filter(([key]) => key !== 'boundaryM')) as ScopeRoomBound),
    })),
  };
}

/** Vista exterior, último paso: las luces se resumen en cuántas hay por estancia (se ven en la referencia). */
function summarizedLuminaires(payload: ScopePayload): ScopePayload {
  return {
    ...payload,
    levels: payload.levels.map((level) => {
      const counts = new Map<string, number>();
      for (const light of level.luminaires) counts.set(light.roomId, (counts.get(light.roomId) ?? 0) + 1);
      return { ...level, luminaires: [...counts].map(([roomId, count]) => ({ roomId, count }) as unknown as ScopeRoomBound) };
    }),
  };
}

/**
 * Degradación por prioridad: se aplican recortes cada vez más agresivos hasta
 * que el prompt cabe. El orden va de lo prescindible (ruido decimal, nombres) a
 * lo que sí informa (estancias vecinas), y nunca toca el texto de política.
 */
export function fitCompactPrompt(
  head: readonly string[],
  payload: ScopePayload,
  serialize: (payload: unknown) => string,
  roomId: string | null = null,
  limit: number = COMPACT_PROMPT_LIMIT,
): string {
  const steps: ((input: ScopePayload) => ScopePayload)[] = [
    (input) => input,
    (input) => roundPayload(input, 3),
    withoutNames,
    (input) => roundPayload(input, 2),
    withoutSlabDetail,
    (input) => onlyCameraRoom(input, roomId),
    // Sin estancia de cámara (vista exterior) no hay a qué acotar: se aligera la planta entera.
    ...(roomId ? [] : [withoutRoomBoundaries, summarizedLuminaires]),
  ];
  let current = payload;
  let prompt = '';
  // Transformaciones sin pérdida que solo cambian cómo se escribe el contexto.
  const emit = (value: unknown) => serialize(aliasRoomIds(roomId ? value : hoistSharedDefaults(value)));
  for (const step of steps) {
    current = step(current);
    prompt = [...head, emit(current)].join('\n');
    if (prompt.length <= limit) return prompt;
  }
  // Último recurso: solo geometría esencial y, si aún no cabe, contornos
  // simplificados con tolerancia creciente (hasta medio metro).
  for (const tolerance of [0, 0.05, 0.1, 0.25, 0.5]) {
    prompt = [...head, emit(essentialGeometry(current, tolerance))].join('\n');
    if (prompt.length <= limit) return prompt;
  }
  return prompt;
}
