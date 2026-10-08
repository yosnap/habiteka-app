/**
 * Estancias leídas en planta abierta (una cocina abierta al comedor) no quedan
 * cerradas por muros, y el editor las fundiría con su vecina. Aquí se cierran con
 * límites OCULTOS, como las zonas exteriores: los tramos de su contorno sin muro
 * se trazan como muro invisible enganchado al muro más cercano.
 *
 * Cada estancia se prueba en una copia y solo se acepta si el editor deriva una
 * estancia de su tamaño; si no, el documento no cambia. Puro y sin IA.
 */
import type { PlanZone } from '@/lib/contracts';
import type { EditorDocument, Point, Wall } from '../schema';
import { vertexId } from './shared';
import { planarizeWalls } from './planarize-walls';
import { deriveRoomsSafe } from '../rooms';

// Un muro paralelo a menos de esto de un lado del contorno lo cubre (cara frente a eje
// y contornos leídos algo torcidos).
const WALL_MATCH_MM = 350;
// Huecos menores en un lado son puertas o juntas, no planta abierta.
const MIN_GAP_MM = 300;
// Distancia máxima para enganchar el extremo de un límite a un muro.
const SNAP_MM = 700;
// La estancia derivada que la contiene no puede superar este múltiplo de la leída.
const MAX_GROWTH = 1.35;

interface Segment { a: Point; b: Point; thicknessMm: number }

/** Cierra con límites ocultos las estancias leídas que el editor fundiría. Devuelve sus nombres. */
export function addOpenPlanBoundaries(doc: EditorDocument, zones: PlanZone[], dimensionalOrigin: Wall['dimensionalOrigin']): string[] {
  const separated: string[] = [];
  // Separar una estancia puede ser lo que permite separar bien la siguiente: se repite.
  for (let pass = 0; pass < 3; pass++) {
    const before = separated.length;
    for (const zone of zones) if (!separated.includes(zone.name) && separateZone(doc, zone, dimensionalOrigin)) separated.push(zone.name);
    if (separated.length === before) break;
  }
  return separated;
}

function separateZone(doc: EditorDocument, zone: PlanZone, dimensionalOrigin: Wall['dimensionalOrigin']): boolean {
  const area = polygonArea(zone.outline);
  if (zone.outline.length < 3 || area < 1_000_000) return false;
  const center = centroid(zone.outline);
  const before = roomArea(doc, center);
  if (before !== null && before <= area * MAX_GROWTH) return false;
  const edges = openPlanBoundaryEdges(doc, zone.outline);
  if (!edges.length) return false;
  const trial = structuredClone(doc);
  edges.forEach((edge, i) => trial.walls.push({
    id: `hidden:open:${zone.id}:${i}`, name: zone.name, hidden: true,
    startVertexId: vertexId(trial, edge.a), endVertexId: vertexId(trial, edge.b), thicknessMm: 80, dimensionalOrigin,
  }));
  try { planarizeWalls(trial); } catch { return false; }
  const after = roomArea(trial, center);
  if (after === null || after > area * MAX_GROWTH || after < area * 0.5) return false;
  const rooms = deriveRoomsSafe(trial), previous = deriveRoomsSafe(doc);
  if (rooms.length <= previous.length) return false;
  // Un límite pegado a un muro crea astillas: mejor dejar la estancia como estaba.
  if (slivers(rooms) > slivers(previous)) return false;
  // Tampoco puede dejar un espacio sin nombre: sería un trozo de otra estancia.
  if (unlabeled(trial, rooms) > unlabeled(doc, previous)) return false;
  Object.assign(doc, trial);
  return true;
}

/** Tramos ocultos que cerrarían este contorno (expuesto para revisarlo en pruebas). */
export function openPlanBoundaryEdges(doc: EditorDocument, outline: Point[]): Segment[] {
  return openEdges(segments(doc), outline);
}

function segments(doc: EditorDocument): Segment[] {
  const vertices = new Map(doc.vertices.map((v) => [v.id, v]));
  return doc.walls.flatMap((wall) => {
    const a = vertices.get(wall.startVertexId), b = vertices.get(wall.endVertexId);
    return a && b ? [{ a, b, thicknessMm: wall.thicknessMm }] : [];
  });
}

interface EdgeLine { p: Point; u: Point; length: number; shift: Point; gaps: Array<{ t0: number; t1: number }> }

/**
 * Tramos del contorno sin muro. Cada lado se lleva al eje de los muros que lo cubren
 * (o medio grosor hacia fuera si no hay ninguno): así el límite no corre pegado a un
 * muro. Las esquinas entre dos tramos abiertos se unen en el cruce de sus ejes y los
 * demás extremos se enganchan al muro más cercano.
 */
function openEdges(walls: Segment[], outline: Point[]): Segment[] {
  const n = outline.length;
  const center = centroid(outline);
  const lines: EdgeLine[] = outline.map((p, i) => edgeLine(walls, p, outline[(i + 1) % n]!, center));
  const corner = (i: number) => intersect(lines[(i - 1 + n) % n]!, lines[i]!);
  const result: Segment[] = [];
  lines.forEach((line, i) => line.gaps.forEach((gap) => {
    const startShared = gap.t0 === 0 && lines[(i - 1 + n) % n]!.gaps.some((other) => other.t1 === lines[(i - 1 + n) % n]!.length);
    const endShared = gap.t1 === line.length && lines[(i + 1) % n]!.gaps.some((other) => other.t0 === 0);
    const a = startShared ? corner(i) : snap(walls, pointOn(line, gap.t0));
    const b = endShared ? corner((i + 1) % n) : snap(walls, pointOn(line, gap.t1));
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= MIN_GAP_MM) result.push({ a, b, thicknessMm: 80 });
  }));
  return result;
}

function edgeLine(walls: Segment[], p: Point, q: Point, center: Point): EdgeLine {
  const length = Math.hypot(q.x - p.x, q.y - p.y);
  const u = length > 0 ? { x: (q.x - p.x) / length, y: (q.y - p.y) / length } : { x: 1, y: 0 };
  let normal = { x: -u.y, y: u.x };
  if ((p.x - center.x) * normal.x + (p.y - center.y) * normal.y < 0) normal = { x: -normal.x, y: -normal.y };
  const covered: Array<[number, number]> = [];
  const offsets: number[] = [];
  for (const wall of walls) {
    const wl = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (wl === 0 || length < MIN_GAP_MM) continue;
    const parallel = Math.abs(((wall.b.x - wall.a.x) * u.y - (wall.b.y - wall.a.y) * u.x) / wl) < 0.17;
    const offset = (wall.a.x - p.x) * normal.x + (wall.a.y - p.y) * normal.y;
    if (!parallel || Math.abs(offset) > WALL_MATCH_MM) continue;
    const t1 = (wall.a.x - p.x) * u.x + (wall.a.y - p.y) * u.y;
    const t2 = (wall.b.x - p.x) * u.x + (wall.b.y - p.y) * u.y;
    const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(length, Math.max(t1, t2));
    if (hi - lo <= 1) continue;
    covered.push([lo, hi]);
    offsets.push(offset);
  }
  const shiftBy = offsets.length ? offsets.reduce((sum, value) => sum + value, 0) / offsets.length : 80;
  covered.sort((x, y) => x[0] - y[0]);
  const gaps: EdgeLine['gaps'] = [];
  let cursor = 0;
  for (const [lo, hi] of covered) {
    if (lo - cursor >= MIN_GAP_MM) gaps.push({ t0: cursor, t1: lo });
    cursor = Math.max(cursor, hi);
  }
  if (length >= MIN_GAP_MM && length - cursor >= MIN_GAP_MM) gaps.push({ t0: cursor, t1: length });
  return { p, u, length, shift: { x: normal.x * shiftBy, y: normal.y * shiftBy }, gaps };
}

function pointOn(line: EdgeLine, t: number): Point {
  return { x: line.p.x + line.shift.x + line.u.x * t, y: line.p.y + line.shift.y + line.u.y * t };
}

/** Cruce de los ejes de dos lados consecutivos (o el extremo del segundo si son paralelos). */
function intersect(a: EdgeLine, b: EdgeLine): Point {
  const pa = pointOn(a, 0), pb = pointOn(b, 0);
  const det = a.u.x * b.u.y - a.u.y * b.u.x;
  if (Math.abs(det) < 1e-6) return pb;
  const t = ((pb.x - pa.x) * b.u.y - (pb.y - pa.y) * b.u.x) / det;
  return { x: pa.x + a.u.x * t, y: pa.y + a.u.y * t };
}

/** Punto más cercano del eje de un muro, o null si ninguno queda cerca. */
function snap(walls: Segment[], point: Point): Point | null {
  let best: Point | null = null, bestDistance = SNAP_MM;
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y, len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / len2));
    const candidate = { x: wall.a.x + dx * t, y: wall.a.y + dy * t };
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

// Estancias derivadas de menos de esto son restos entre muros, no espacios.
const SLIVER_M2 = 500_000;
const slivers = (rooms: ReturnType<typeof deriveRoomsSafe>) =>
  rooms.filter((room) => polygonArea(room.boundary) < SLIVER_M2).length;

// Un resto sin nombre por debajo de esto es un trozo de otra estancia; uno mayor (un pasillo
// sin rotular) es un espacio real y puede quedar aparte.
const LEFTOVER_M2 = 3_000_000;
const unlabeled = (doc: EditorDocument, rooms: ReturnType<typeof deriveRoomsSafe>) =>
  rooms.filter((room) => polygonArea(room.boundary) < LEFTOVER_M2 && !doc.labels.some((label) => inside(label, room.boundary))).length;

function roomArea(doc: EditorDocument, point: Point): number | null {
  const room = deriveRoomsSafe(doc).find((item) => inside(point, item.boundary));
  return room ? polygonArea(room.boundary) : null;
}

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function centroid(points: Point[]): Point {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

function inside(point: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
