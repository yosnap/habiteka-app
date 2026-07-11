/**
 * Normalización geométrica del boceto extraído: convierte el `RawSketch` (trazos
 * imperfectos en coordenadas de imagen 0–1) en un `Plano2dPayload` métrico.
 *
 * 100 % determinista y pura (sin red, sin IA, sin aleatoriedad): mismo boceto
 * extraído → mismo plano. Pasos: ortogonalizar trazos casi rectos, cerrar
 * esquinas (snap de vértices), escalar a milímetros y anclar aberturas de forma
 * que quepan en su muro.
 */
import type {
  PlanAperture,
  PlanDimension,
  PlanPoint,
  PlanWall,
  PlanZone,
  Plano2dPayload,
} from '@/lib/contracts';
import type { RawSketch, SketchPoint, SketchWall } from './sketch-types';

export interface NormalizeOptions {
  /** Ancho real del plano en metros si el boceto no lo indica. */
  fallbackWidthMeters: number;
  /** Desviación máxima (grados) para considerar un trazo horizontal/vertical. */
  angleToleranceDeg: number;
  /** Distancia máxima (en unidades de imagen) para fusionar vértices cercanos. */
  snapDistance: number;
  /** Longitud mínima de un muro (en unidades de imagen); por debajo, es ruido. */
  minWallLength: number;
  /** Grosor de muro asignado (mm). Coincide con el del plano base de entrega. */
  wallThicknessMm: number;
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  fallbackWidthMeters: 8,
  angleToleranceDeg: 12,
  snapDistance: 0.03,
  minWallLength: 0.02,
  wallThicknessMm: 120,
};

// Ancho por defecto de cada abertura (mm) cuando el boceto no lo insinúa.
const DEFAULT_APERTURE_WIDTH_MM: Record<PlanAperture['kind'], number> = {
  puerta: 900,
  ventana: 1200,
  hueco: 900,
};

// Una abertura nunca ocupa más que esta fracción de su muro.
const MAX_APERTURE_WALL_RATIO = 0.8;

/** Convierte la extracción cruda de un boceto en un plano métrico normalizado. */
export function normalizeSketch(
  raw: RawSketch,
  options: Partial<NormalizeOptions> = {},
): Plano2dPayload {
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };

  // Índices originales conservados: las aberturas referencian muros por índice
  // y el filtrado/snap no debe romper esa referencia.
  let walls = raw.muros.map((w, index) => ({ ...w, index }));
  walls = walls.filter((w) => segmentLength(w) >= opts.minWallLength);
  walls = alignToGrid(walls, opts);
  // El snap puede colapsar un muro corto en un punto: sin dirección, fuera.
  walls = walls.filter((w) => segmentLength(w) > 0);

  const scale = resolveScale(raw, opts.fallbackWidthMeters);
  const planWalls = walls.map((w, i) => ({
    wall: toPlanWall(w, i, scale, opts.wallThicknessMm),
    sourceIndex: w.index,
  }));

  const apertures = buildApertures(raw, planWalls);
  const dimensions = planWalls.map(({ wall }, i) => toDimension(wall, i));
  const zones = buildZones(raw, planWalls, apertures, dimensions, scale);

  return { schemaVersion: 1, zones };
}

// ── Geometría en unidades de imagen ──────────────────────────────────────────

interface IndexedWall extends SketchWall {
  index: number;
}

function segmentLength(w: SketchWall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

type Orientation = 'h' | 'v' | 'diag';

/** Clasifica el trazo por su ángulo respecto a los ejes. */
function orientationOf(w: SketchWall, toleranceDeg: number): Orientation {
  const dx = Math.abs(w.x2 - w.x1);
  const dy = Math.abs(w.y2 - w.y1);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = horizontal, 90 = vertical
  if (angle <= toleranceDeg) return 'h';
  if (angle >= 90 - toleranceDeg) return 'v';
  return 'diag'; // Diagonal intencionada: se respeta.
}

/**
 * Endereza y cierra esquinas SOBRE UN GRAFO DE VÉRTICES compartidos, no muro a
 * muro: mover extremos por separado (ortogonalizar tras el snap) reabriría las
 * esquinas que el snap acababa de cerrar.
 *
 *  1. Snap: extremos cercanos se fusionan en un vértice común (centroide).
 *  2. Restricciones: un muro casi horizontal exige que sus dos vértices
 *     compartan `y`; uno casi vertical, que compartan `x`. Las componentes
 *     conexas de esa relación (union-find) promedian su coordenada.
 *
 * Así un vértice en una esquina en L recibe la `y` del muro horizontal y la `x`
 * del vertical a la vez, y la esquina queda cerrada y ortogonal.
 */
function alignToGrid(walls: IndexedWall[], opts: NormalizeOptions): IndexedWall[] {
  // 1. Agrupado greedy determinista de extremos en vértices.
  const vertices: SketchPoint[] = [];
  const counts: number[] = [];

  const vertexOf = (p: SketchPoint): number => {
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]!;
      if (Math.hypot(p.x - v.x, p.y - v.y) <= opts.snapDistance) {
        counts[i]!++;
        vertices[i] = {
          x: v.x + (p.x - v.x) / counts[i]!,
          y: v.y + (p.y - v.y) / counts[i]!,
        };
        return i;
      }
    }
    vertices.push({ ...p });
    counts.push(1);
    return vertices.length - 1;
  };

  const ends = walls.map((w) => ({
    a: vertexOf({ x: w.x1, y: w.y1 }),
    b: vertexOf({ x: w.x2, y: w.y2 }),
    orientation: orientationOf(w, opts.angleToleranceDeg),
  }));

  // 2. Union-find por coordenada: `y` para muros horizontales, `x` para verticales.
  const yGroup = new UnionFind(vertices.length);
  const xGroup = new UnionFind(vertices.length);
  for (const e of ends) {
    if (e.orientation === 'h') yGroup.union(e.a, e.b);
    if (e.orientation === 'v') xGroup.union(e.a, e.b);
  }

  const aligned = vertices.map((v, i) => ({
    x: average(vertices, xGroup.members(i)) ?? v.x,
    y: average(vertices, yGroup.members(i), 'y') ?? v.y,
  }));

  return walls.map((w, i) => {
    const { a, b } = ends[i]!;
    return { index: w.index, x1: aligned[a]!.x, y1: aligned[a]!.y, x2: aligned[b]!.x, y2: aligned[b]!.y };
  });
}

/** Media de una coordenada sobre un grupo de vértices; null si el grupo es unitario. */
function average(vertices: SketchPoint[], members: number[], axis: 'x' | 'y' = 'x'): number | null {
  if (members.length <= 1) return null;
  const sum = members.reduce((acc, i) => acc + vertices[i]![axis], 0);
  return sum / members.length;
}

/** Union-find mínimo con listado de miembros por componente. */
class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!;
      i = this.parent[i]!;
    }
    return i;
  }

  union(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b);
  }

  members(i: number): number[] {
    const root = this.find(i);
    const out: number[] = [];
    for (let j = 0; j < this.parent.length; j++) if (this.find(j) === root) out.push(j);
    return out;
  }
}

// ── Escala y conversión a milímetros ─────────────────────────────────────────

interface Scale {
  mmPerUnitX: number;
  mmPerUnitY: number;
}

/**
 * Escala imagen→mm. Si el boceto solo da el ancho, el alto usa la misma escala
 * (asume imagen de proporción fiel al dibujo, suficiente para v1).
 */
function resolveScale(raw: RawSketch, fallbackWidthMeters: number): Scale {
  const widthM = raw.anchoMetros ?? fallbackWidthMeters;
  const heightM = raw.altoMetros ?? widthM;
  return { mmPerUnitX: widthM * 1000, mmPerUnitY: heightM * 1000 };
}

function toMm(p: SketchPoint, s: Scale): PlanPoint {
  return { x: Math.round(p.x * s.mmPerUnitX), y: Math.round(p.y * s.mmPerUnitY) };
}

function toPlanWall(w: SketchWall, i: number, s: Scale, thicknessMm: number): PlanWall {
  return {
    id: `w${i}`,
    from: toMm({ x: w.x1, y: w.y1 }, s),
    to: toMm({ x: w.x2, y: w.y2 }, s),
    thicknessMm,
  };
}

function wallLengthMm(w: PlanWall): number {
  return Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y);
}

// ── Aberturas ────────────────────────────────────────────────────────────────

function buildApertures(
  raw: RawSketch,
  planWalls: Array<{ wall: PlanWall; sourceIndex: number }>,
): PlanAperture[] {
  const bySource = new Map(planWalls.map((pw) => [pw.sourceIndex, pw.wall]));
  const out: PlanAperture[] = [];
  for (const a of raw.aberturas) {
    const wall = bySource.get(a.muro);
    if (!wall) continue; // Su muro se descartó como ruido.
    const lengthMm = wallLengthMm(wall);
    const requested = a.anchoSobreMuro
      ? a.anchoSobreMuro * lengthMm
      : DEFAULT_APERTURE_WIDTH_MM[a.tipo];
    const widthMm = Math.round(Math.min(requested, lengthMm * MAX_APERTURE_WALL_RATIO));
    if (widthMm <= 0) continue;
    // La abertura debe caber entera dentro del muro: se acota el centro.
    const halfRatio = widthMm / lengthMm / 2;
    const position = clamp(a.posicion, halfRatio, 1 - halfRatio);
    out.push({ id: `a${out.length}`, kind: a.tipo, wallId: wall.id, position, widthMm });
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// ── Cotas ────────────────────────────────────────────────────────────────────

function toDimension(wall: PlanWall, i: number): PlanDimension {
  const meters = wallLengthMm(wall) / 1000;
  return {
    id: `dim${i}`,
    from: wall.from,
    to: wall.to,
    label: `${meters.toFixed(2)} m`,
  };
}

// ── Zonas (habitaciones) ─────────────────────────────────────────────────────

/**
 * Reparte muros/aberturas/cotas entre las habitaciones detectadas. Un muro se
 * asigna a la habitación cuyo centroide queda más cerca de su punto medio (los
 * muros SON frontera entre estancias, así que la contención en polígono es
 * ambigua; el centroide más cercano es determinista y suficiente para v1).
 */
function buildZones(
  raw: RawSketch,
  planWalls: Array<{ wall: PlanWall; sourceIndex: number }>,
  apertures: PlanAperture[],
  dimensions: PlanDimension[],
  scale: Scale,
): PlanZone[] {
  const walls = planWalls.map((pw) => pw.wall);
  if (raw.habitaciones.length === 0) {
    return [{ id: 'z0', name: 'Estancia', outline: outlineFromWalls(walls), walls, apertures, dimensions }];
  }

  const zones: PlanZone[] = raw.habitaciones.map((room, i) => ({
    id: `z${i}`,
    name: room.nombre,
    outline: room.poligono.map((p) => toMm(p, scale)),
    walls: [],
    apertures: [],
    dimensions: [],
  }));
  const centroids = zones.map((z) => polygonCentroid(z.outline));

  const zoneOfWall = new Map<string, PlanZone>();
  walls.forEach((wall, i) => {
    const mid = { x: (wall.from.x + wall.to.x) / 2, y: (wall.from.y + wall.to.y) / 2 };
    const zone = zones[nearestIndex(mid, centroids)]!;
    zone.walls.push(wall);
    zone.dimensions.push(dimensions[i]!);
    zoneOfWall.set(wall.id, zone);
  });
  // Cada abertura viaja con su muro para que la zona sea autocontenida.
  for (const ap of apertures) zoneOfWall.get(ap.wallId)?.apertures.push(ap);

  return zones;
}

/** Contorno de respaldo: bounding box de todos los muros. */
function outlineFromWalls(walls: PlanWall[]): PlanPoint[] {
  if (walls.length === 0) return [];
  const xs = walls.flatMap((w) => [w.from.x, w.to.x]);
  const ys = walls.flatMap((w) => [w.from.y, w.to.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function polygonCentroid(points: PlanPoint[]): PlanPoint {
  const n = points.length;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

function nearestIndex(p: PlanPoint, candidates: PlanPoint[]): number {
  let best = 0;
  let bestDist = Infinity;
  candidates.forEach((c, i) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}
