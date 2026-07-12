/**
 * Normalización geométrica del boceto extraído: convierte el `RawSketch` (trazos
 * imperfectos en coordenadas de imagen 0–1) en un `Plano2dPayload` métrico.
 *
 * 100 % determinista y pura (sin red, sin IA, sin aleatoriedad): mismo boceto
 * extraído → mismo plano. Pasos:
 *
 *  1. Ortogonalizar y cerrar esquinas sobre un grafo de vértices compartidos.
 *  2. Limpiar la topología (caras dobles de un muro grueso, tramos colineales
 *     troceados) — defectos sistemáticos de la visión sobre dibujos a mano.
 *  3. Escalar a milímetros con saneo de plausibilidad (un piso con varias
 *     estancias no mide 3 m de ancho).
 *  4. Anclar aberturas POR GEOMETRÍA (los índices de muro del modelo dejan de
 *     valer tras fusionar/descartar segmentos).
 *  5. Cotas solo donde informan: muros exteriores y largos, no cada fragmento.
 */
import type {
  PlanAperture,
  PlanDimension,
  PlanPoint,
  PlanWall,
  PlanZone,
  Plano2dPayload,
} from '@/lib/contracts';
import type { RawSketch, SketchAperture, SketchPoint, SketchWall } from './sketch-types';
import {
  collapseDoubleWalls,
  dropIsolatedShortWalls,
  mergeCollinear,
  snapEndpointsToWalls,
} from './wall-cleanup';

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
  /** Longitud mínima (mm) de un muro para merecer cota. */
  minDimensionMm: number;
  /**
   * Longitud mínima (unidades de imagen) de un muro DIAGONAL. Los diagonales
   * cortos son casi siempre arcos de barrido de puertas que el modelo leyó
   * como muros; los diagonales reales (chaflanes) son largos.
   */
  minDiagonalLength: number;
  /**
   * Muros medidos por DETECCIÓN DE PÍXELES (precisos) que sustituyen a los del
   * modelo de visión (estimados a ojo). Las aberturas y habitaciones del
   * modelo se siguen usando: las semillas se anclan por geometría al muro
   * final, venga de donde venga.
   */
  wallsOverride?: SketchWall[];
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  fallbackWidthMeters: 8,
  angleToleranceDeg: 12,
  snapDistance: 0.03,
  minWallLength: 0.02,
  wallThicknessMm: 120,
  minDimensionMm: 1200,
  minDiagonalLength: 0.07,
};

// Ancho por defecto de cada abertura (mm) cuando el boceto no lo insinúa.
const DEFAULT_APERTURE_WIDTH_MM: Record<PlanAperture['kind'], number> = {
  puerta: 900,
  ventana: 1200,
  hueco: 900,
};

// Una abertura nunca ocupa más que esta fracción de su muro.
const MAX_APERTURE_WALL_RATIO = 0.8;
// Mínimo de muros detectados por píxeles para fiarse de ellos (menos = la
// imagen no era un plano limpio y se cae a los muros del modelo).
const MIN_OVERRIDE_WALLS = 4;
// Hueco máximo (unidades de imagen) que se puentea entre tramos colineales
// detectados por píxeles: cubre vanos de puerta/ventana típicos.
const MAX_BRIDGE_GAP = 0.16;
// Dos aberturas del mismo muro a menos de esta distancia son la misma (duplicado del modelo).
const MIN_APERTURE_GAP_MM = 400;

/** Convierte la extracción cruda de un boceto en un plano métrico normalizado. */
export function normalizeSketch(
  raw: RawSketch,
  options: Partial<NormalizeOptions> = {},
): Plano2dPayload {
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };

  // Semillas de abertura con geometría ABSOLUTA antes de tocar los muros: los
  // índices del modelo dejan de valer tras filtrar/fusionar segmentos.
  const seeds = raw.aberturas
    .map((a) => apertureSeed(a, raw.muros))
    .filter((s): s is ApertureSeed => s !== null);

  const fromPixels = (opts.wallsOverride?.length ?? 0) >= MIN_OVERRIDE_WALLS;
  const sourceWalls = fromPixels ? opts.wallsOverride! : raw.muros;

  let walls = sourceWalls.filter((w) => segmentLength(w) >= opts.minWallLength);
  walls = alignToGrid(walls, opts);
  walls = collapseDoubleWalls(walls, opts.snapDistance * 1.5, opts.angleToleranceDeg);
  walls = mergeCollinear(walls, opts.angleToleranceDeg, opts.snapDistance);
  if (fromPixels) {
    // Los vanos de puerta/ventana parten un muro detectado por píxeles en
    // tramos colineales con hueco: se puentean (la abertura vuelve a colocarse
    // encima al anclar las semillas). El desvío lateral queda acotado para no
    // fusionar dos muros paralelos de verdad.
    walls = mergeCollinear(walls, opts.angleToleranceDeg, MAX_BRIDGE_GAP, opts.snapDistance);
  }
  // Re-enderezar tras la limpieza: fusionar dos tramos casi colineales con
  // desfase lateral produce un muro largo LIGERAMENTE inclinado; sin este paso
  // el plano sale con muros torcidos (visto con el primer plano real).
  walls = alignToGrid(walls, opts);
  // Diagonales cortos = arcos de puerta leídos como muros; fuera.
  walls = walls.filter(
    (w) =>
      orientationOf(w, opts.angleToleranceDeg) !== 'diag' ||
      segmentLength(w) >= opts.minDiagonalLength,
  );
  // Cerrar juntas en T: extremos que se quedan a un pelo de otro muro.
  walls = snapEndpointsToWalls(walls, opts.snapDistance * 1.5);
  // Fragmentos cortos que no tocan nada = ruido (mobiliario/sombra leída como muro).
  walls = dropIsolatedShortWalls(walls, opts.minDiagonalLength * 2, opts.snapDistance);
  // La limpieza puede colapsar un muro corto en un punto: sin dirección, fuera.
  walls = walls.filter((w) => segmentLength(w) > 0);

  const scale = resolveScale(raw, walls, opts);
  const planWalls = walls.map((w, i) => toPlanWall(w, i, scale, opts.wallThicknessMm));

  const apertures = anchorApertures(seeds, walls, planWalls, scale, opts);
  const dimByWallId = buildDimensions(planWalls, opts);
  const zones = buildZones(raw, planWalls, apertures, dimByWallId, scale);

  return { schemaVersion: 1, zones };
}

// ── Geometría en unidades de imagen ──────────────────────────────────────────

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
function alignToGrid(walls: SketchWall[], opts: NormalizeOptions): SketchWall[] {
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

  return walls.map((_, i) => {
    const { a, b } = ends[i]!;
    return { x1: aligned[a]!.x, y1: aligned[a]!.y, x2: aligned[b]!.x, y2: aligned[b]!.y };
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

// Lado mayor plausible de un plano: por debajo/encima se corrige la escala.
const MAX_PLAUSIBLE_SIDE_M = 40;

/**
 * Escala imagen→mm. Si el boceto solo da el ancho, el alto usa la misma escala.
 * Saneo de plausibilidad: si la escala estimada (o el fallback) deja el plano
 * implausiblemente pequeño para su número de estancias — dormitorios de 2 m² —
 * se reescala a un tamaño creíble preservando proporciones.
 */
function resolveScale(raw: RawSketch, walls: SketchWall[], opts: NormalizeOptions): Scale {
  const widthM = raw.anchoMetros ?? opts.fallbackWidthMeters;
  const heightM = raw.altoMetros ?? widthM;
  let mmX = widthM * 1000;
  let mmY = heightM * 1000;

  if (walls.length > 0) {
    const xs = walls.flatMap((w) => [w.x1, w.x2]);
    const ys = walls.flatMap((w) => [w.y1, w.y2]);
    const sideM = Math.max(
      ((Math.max(...xs) - Math.min(...xs)) * mmX) / 1000,
      ((Math.max(...ys) - Math.min(...ys)) * mmY) / 1000,
    );
    const rooms = raw.habitaciones.length;
    // Un plano multi-estancia mide al menos ~7 m de lado; uno simple, ~2,5 m.
    const minSide = rooms >= 2 ? 7 : 2.5;
    const targetSide = rooms >= 2 ? 10 : 4;
    let factor = 1;
    if (sideM > 0 && sideM < minSide) factor = targetSide / sideM;
    else if (sideM > MAX_PLAUSIBLE_SIDE_M) factor = 15 / sideM;
    factor = Math.min(Math.max(factor, 0.1), 10);
    mmX *= factor;
    mmY *= factor;
  }

  return { mmPerUnitX: mmX, mmPerUnitY: mmY };
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

interface ApertureSeed {
  tipo: PlanAperture['kind'];
  /** Centro de la abertura en coordenadas de imagen. */
  center: SketchPoint;
  /** Ancho en unidades de imagen (a lo largo del muro), si el modelo lo dio. */
  widthUnit?: number;
}

/** Geometría absoluta de una abertura a partir del muro crudo que referencia. */
function apertureSeed(a: SketchAperture, rawWalls: SketchWall[]): ApertureSeed | null {
  const w = rawWalls[a.muro];
  if (!w) return null;
  const len = segmentLength(w);
  if (len <= 0) return null;
  return {
    tipo: a.tipo,
    center: {
      x: w.x1 + (w.x2 - w.x1) * a.posicion,
      y: w.y1 + (w.y2 - w.y1) * a.posicion,
    },
    ...(a.anchoSobreMuro ? { widthUnit: a.anchoSobreMuro * len } : {}),
  };
}

/**
 * Ancla cada semilla al muro FINAL más cercano (proyección perpendicular).
 * Descarta las que quedan lejos de todo muro y deduplica las que caen casi en
 * el mismo punto del mismo muro (el modelo repite aberturas con frecuencia).
 */
function anchorApertures(
  seeds: ApertureSeed[],
  walls: SketchWall[],
  planWalls: PlanWall[],
  scale: Scale,
  opts: NormalizeOptions,
): PlanAperture[] {
  const out: PlanAperture[] = [];
  const maxPerp = opts.snapDistance * 2;

  for (const seed of seeds) {
    let best: { wall: PlanWall; t: number; perp: number } | null = null;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i]!;
      const len = segmentLength(w);
      if (len <= 0) continue;
      const dx = (w.x2 - w.x1) / len;
      const dy = (w.y2 - w.y1) / len;
      const relX = seed.center.x - w.x1;
      const relY = seed.center.y - w.y1;
      const t = (relX * dx + relY * dy) / len;
      if (t < -0.1 || t > 1.1) continue;
      const perp = Math.abs(relX * -dy + relY * dx);
      if (perp > maxPerp) continue;
      if (!best || perp < best.perp) best = { wall: planWalls[i]!, t, perp };
    }
    if (!best) continue; // Lejos de todo muro: era ruido o su muro se descartó.

    const lengthMm = wallLengthMm(best.wall);
    if (lengthMm <= 0) continue;
    // Ancho en mm: la semilla trae el ancho en unidades de imagen; se proyecta
    // con la escala media (las aberturas viven sobre muros casi axis-aligned).
    const requested = seed.widthUnit
      ? seed.widthUnit * ((scale.mmPerUnitX + scale.mmPerUnitY) / 2)
      : DEFAULT_APERTURE_WIDTH_MM[seed.tipo];
    const widthMm = Math.round(Math.min(requested, lengthMm * MAX_APERTURE_WALL_RATIO));
    if (widthMm <= 0) continue;

    const halfRatio = widthMm / lengthMm / 2;
    const position = clamp(best.t, halfRatio, 1 - halfRatio);

    // Deduplicado: otra abertura del mismo muro casi en el mismo sitio es un
    // duplicado del modelo, no una segunda carpintería.
    const duplicated = out.some(
      (ap) =>
        ap.wallId === best!.wall.id &&
        Math.abs(ap.position - position) * lengthMm < MIN_APERTURE_GAP_MM,
    );
    if (duplicated) continue;

    out.push({ id: `a${out.length}`, kind: seed.tipo, wallId: best.wall.id, position, widthMm });
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// ── Cotas ────────────────────────────────────────────────────────────────────

// Un muro se considera exterior si su punto medio queda a menos de esto del
// borde del plano (bounding box de todos los muros).
const EXTERIOR_TOLERANCE_MM = 300;

/**
 * Cotas SOLO donde informan: muros exteriores y de longitud significativa. Una
 * cota por fragmento interior (el defecto del primer render real) entierra el
 * plano en números. Si ningún muro califica, se acota el bounding box total.
 */
function buildDimensions(
  planWalls: PlanWall[],
  opts: NormalizeOptions,
): Map<string, PlanDimension> {
  const out = new Map<string, PlanDimension>();
  if (planWalls.length === 0) return out;

  const xs = planWalls.flatMap((w) => [w.from.x, w.to.x]);
  const ys = planWalls.flatMap((w) => [w.from.y, w.to.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let i = 0;
  for (const wall of planWalls) {
    if (wallLengthMm(wall) < opts.minDimensionMm) continue;
    const mid = { x: (wall.from.x + wall.to.x) / 2, y: (wall.from.y + wall.to.y) / 2 };
    const nearEdge =
      Math.min(mid.x - minX, maxX - mid.x) <= EXTERIOR_TOLERANCE_MM ||
      Math.min(mid.y - minY, maxY - mid.y) <= EXTERIOR_TOLERANCE_MM;
    if (!nearEdge) continue;
    out.set(wall.id, toDimension(wall, i++));
  }

  // Ningún muro califica (plano pequeño o todo interior): cota global del bbox.
  if (out.size === 0 && maxX > minX) {
    const first = planWalls[0]!;
    out.set(first.id, {
      id: 'dim0',
      from: { x: minX, y: maxY },
      to: { x: maxX, y: maxY },
      label: `${((maxX - minX) / 1000).toFixed(2)} m`,
    });
  }
  return out;
}

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
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  dimByWallId: Map<string, PlanDimension>,
  scale: Scale,
): PlanZone[] {
  if (raw.habitaciones.length === 0) {
    return [
      {
        id: 'z0',
        name: 'Estancia',
        outline: outlineFromWalls(planWalls),
        walls: planWalls,
        apertures,
        dimensions: [...dimByWallId.values()],
      },
    ];
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
  for (const wall of planWalls) {
    const mid = { x: (wall.from.x + wall.to.x) / 2, y: (wall.from.y + wall.to.y) / 2 };
    const zone = zones[nearestIndex(mid, centroids)]!;
    zone.walls.push(wall);
    const dim = dimByWallId.get(wall.id);
    if (dim) zone.dimensions.push(dim);
    zoneOfWall.set(wall.id, zone);
  }
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
  const n = Math.max(1, points.length);
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
