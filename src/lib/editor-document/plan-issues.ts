/**
 * Detectores ÚNICOS de los defectos medibles del plano y su redacción para el
 * usuario.
 *
 * Los mismos detectores alimentan la evidencia que se manda a Jev
 * (`buildEditorEvidence`) y la lista de incidencias localizables del diálogo de
 * calidad (`planIssues`), para que el número que ve el usuario en la tarjeta y
 * los elementos que puede señalar en el plano nunca discrepen.
 *
 * Todo es puro y sin DOM: recibe un documento y devuelve identificadores.
 */
import { distance, wallPoints } from './geometry';
import { isRampLanding } from './ramp-kind';
import { deriveRooms } from './rooms';
import type { EditorDocument, Point } from './schema';

/** Longitud por debajo de la cual un muro no aporta geometría (mm). */
export const DEGENERATE_WALL_MM = 10;
/**
 * Un extremo suelto a esta distancia de otro muro deja un paso transitable sin
 * puerta (entrada, arco, pasillo abierto): es arquitectura, no un error. Más
 * cerca es un muro mal unido; más lejos, un muro que no llega a nada.
 */
export const PASSAGE_MIN_MM = 600;
export const PASSAGE_MAX_MM = 2500;

export type PlanIssueKind =
  | 'extremos-sueltos'
  | 'muros-degenerados'
  | 'huecos-sin-muro'
  | 'huecos-fuera-de-muro'
  | 'puertas-estrechas'
  | 'suelos-sin-estancia'
  | 'accesos-incoherentes';

/** Reparación automática disponible para una incidencia. */
export type PlanIssueFix = 'collapse-degenerate-walls' | 'prune-orphan-floor-finishes';

export interface PlanIssue {
  kind: PlanIssueKind;
  /** Texto para el usuario, idéntico al de la tarjeta de fiabilidad. */
  message: string;
  /** Elementos del plano a los que apunta; vacío si el defecto no se puede señalar. */
  ids: string[];
  fix?: PlanIssueFix;
}

/** Defectos del nivel con los elementos concretos que los provocan. */
export interface PlanDefects {
  /** Muros de longitud casi nula. */
  degenerateWallIds: string[];
  /** Muros con algún extremo sin unir que tampoco deja un paso. */
  looseEndWallIds: string[];
  /** Extremos sueltos contados uno a uno (un muro puede tener dos). */
  looseEnds: number;
  /** Extremos que dejan un paso abierto sin puerta, a propósito. */
  passages: number;
  openingsWithoutWall: string[];
  openingsOutsideWall: string[];
  narrowDoorIds: string[];
  /** Estancias de acabados de suelo que ya no existen; `null` si no se pudo derivar. */
  orphanFloorFinishRoomIds: string[] | null;
  incoherentStairIds: string[];
  /** Rampas incoherentes; los descansillos (`riseMm` 0 legítimo) nunca cuentan. */
  incoherentRampIds: string[];
}

/** Recorre un nivel y localiza todos los defectos medibles de una sola pasada. */
export function planDefects(doc: EditorDocument): PlanDefects {
  const walls = new Map(doc.walls.map((wall) => [wall.id, wall]));
  const ends = danglingEnds(doc);
  const roomIds = safeRoomIds(doc);
  const finishes = doc.floorFinishes ?? [];
  return {
    degenerateWallIds: doc.walls
      .filter((wall) => isDegenerateWall(doc, wall))
      .map((wall) => wall.id),
    looseEndWallIds: ends.looseWallIds,
    looseEnds: ends.loose,
    passages: ends.passages,
    openingsWithoutWall: doc.openings.filter((o) => !walls.has(o.wallId)).map((o) => o.id),
    openingsOutsideWall: doc.openings
      .filter((o) => walls.has(o.wallId) && !fitsInWall(doc, walls.get(o.wallId)!, o))
      .map((o) => o.id),
    // Umbral de revisión del producto, no una certificación de accesibilidad.
    narrowDoorIds: doc.openings.filter(o => o.kind === 'puerta' && o.widthMm < 650).map(o => o.id),
    orphanFloorFinishRoomIds: roomIds
      ? finishes.filter((finish) => !roomIds.has(finish.roomId)).map((finish) => finish.roomId)
      : null,
    incoherentStairIds: (doc.stairs ?? []).filter(isIncoherentStair).map((stair) => stair.id),
    incoherentRampIds: (doc.ramps ?? []).filter(isIncoherentRamp).map((ramp) => ramp.id),
  };
}

/** Un muro sin longitud útil: resto de una unión, invisible pero rompe la topología. */
export function isDegenerateWall(doc: EditorDocument, wall: EditorDocument['walls'][number]): boolean {
  const [from, to] = wallPoints(doc, wall);
  return distance(from, to) < DEGENERATE_WALL_MM;
}

export function isIncoherentStair(stair: NonNullable<EditorDocument['stairs']>[number]): boolean {
  return stair.heightMm <= 0 || stair.stepCount <= 0 || stair.widthMm <= 0 || stair.depthMm <= 0;
}

/**
 * Una rampa con medidas imposibles. Un DESCANSILLO es una plataforma plana: su
 * desnivel cero es legítimo y no se cuenta como defecto.
 */
export function isIncoherentRamp(ramp: NonNullable<EditorDocument['ramps']>[number]): boolean {
  if (ramp.depthMm <= 0 || ramp.widthMm <= 0) return true;
  return !isRampLanding(ramp) && ramp.riseMm <= 0;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Redacción única de cada defecto, compartida por la tarjeta y la lista reparable. */
export function planIssueMessage(kind: PlanIssueKind, n: number): string {
  switch (kind) {
    case 'extremos-sueltos':
      return `${count(n, 'extremo de muro no se une', 'extremos de muro no se unen')} a ningún otro muro.`;
    case 'muros-degenerados':
      return `${count(n, 'muro tiene', 'muros tienen')} una longitud casi nula.`;
    case 'huecos-sin-muro':
      return `${count(n, 'puerta o ventana no está', 'puertas o ventanas no están')} sobre ningún muro.`;
    case 'huecos-fuera-de-muro':
      return `${count(n, 'puerta o ventana sobresale', 'puertas o ventanas sobresalen')} de su muro.`;
    case 'puertas-estrechas':
      return `${count(n, 'puerta tiene', 'puertas tienen')} un hueco de menos de 65 cm. Revisa su ancho en Propiedades; la IA conservará esa medida.`;
    case 'suelos-sin-estancia':
      return `${count(n, 'acabado de suelo no corresponde', 'acabados de suelo no corresponden')} a ninguna estancia.`;
    case 'accesos-incoherentes':
      return `${count(n, 'escalera o rampa tiene', 'escaleras o rampas tienen')} medidas incoherentes.`;
  }
}

/**
 * Incidencias localizables de la PLANTA ACTIVA, en el mismo orden y con el
 * mismo texto que los motivos de la tarjeta de fiabilidad. La tarjeta suma
 * todas las plantas del edificio; aquí solo va lo que se puede seleccionar y
 * reparar sin cambiar de planta.
 */
export function planIssues(doc: EditorDocument): PlanIssue[] {
  const defects = planDefects(doc);
  const issues: PlanIssue[] = [];
  const add = (kind: PlanIssueKind, ids: string[], n = ids.length, fix?: PlanIssueFix) => {
    if (n > 0) issues.push({ kind, message: planIssueMessage(kind, n), ids, ...(fix ? { fix } : {}) });
  };
  add('extremos-sueltos', defects.looseEndWallIds, defects.looseEnds);
  add('muros-degenerados', defects.degenerateWallIds, undefined, 'collapse-degenerate-walls');
  add('huecos-sin-muro', defects.openingsWithoutWall);
  add('huecos-fuera-de-muro', defects.openingsOutsideWall);
  add('puertas-estrechas', defects.narrowDoorIds);
  // Un acabado huérfano no tiene forma en el plano: solo se puede limpiar.
  add('suelos-sin-estancia', [], defects.orphanFloorFinishRoomIds?.length ?? 0, 'prune-orphan-floor-finishes');
  add('accesos-incoherentes', [...defects.incoherentStairIds, ...defects.incoherentRampIds]);
  return issues;
}

function safeRoomIds(doc: EditorDocument): Set<string> | null {
  try {
    return new Set(deriveRooms(doc).map((room) => room.id));
  } catch {
    return null;
  }
}

/** Extremos de muro que no comparten vértice con ningún otro muro del nivel. */
export function danglingEnds(doc: EditorDocument): { loose: number; passages: number; looseWallIds: string[]; points: (Point & { wallId: string })[] } {
  const uses = new Map<string, number>();
  for (const wall of doc.walls)
    for (const id of [wall.startVertexId, wall.endVertexId])
      uses.set(id, (uses.get(id) ?? 0) + 1);
  const segments = doc.walls.map((wall) => ({ wall, points: wallPoints(doc, wall) }));
  let loose = 0,
    passages = 0;
  const looseWallIds: string[] = [];
  const loosePoints: (Point & { wallId: string })[] = [];
  for (const { wall, points } of segments) {
    for (const [index, id] of [wall.startVertexId, wall.endVertexId].entries()) {
      if (uses.get(id) !== 1) continue;
      const end = points[index]!;
      const gap = Math.min(
        Infinity,
        ...segments
          .filter((other) => other.wall.id !== wall.id)
          .map((other) => distanceToSegment(end, other.points[0], other.points[1])),
      );
      if (gap >= PASSAGE_MIN_MM && gap <= PASSAGE_MAX_MM) passages += 1;
      else {
        loose += 1;
        loosePoints.push({ x: end.x, y: end.y, wallId: wall.id });
        if (!looseWallIds.includes(wall.id)) looseWallIds.push(wall.id);
      }
    }
  }
  return { loose, passages, looseWallIds, points: loosePoints };
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    lengthSq = dx * dx + dy * dy;
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
    : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Un hueco cabe si su centro y su ancho quedan dentro del muro que lo sostiene. */
function fitsInWall(
  doc: EditorDocument,
  wall: EditorDocument['walls'][number],
  opening: EditorDocument['openings'][number],
): boolean {
  const [from, to] = wallPoints(doc, wall);
  const length = distance(from, to);
  if (length <= 0 || opening.widthMm <= 0) return false;
  if (opening.position < 0 || opening.position > 1) return false;
  const half = opening.widthMm / 2 / length;
  return opening.position - half >= -1e-6 && opening.position + half <= 1 + 1e-6;
}
