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
  bridgeCollinearGaps,
  collapseDoubleWalls,
  dropIsolatedShortWalls,
  dropSmallComponents,
  mergeCollinear,
  snapEndpointsToWalls,
  type WallGap,
} from './wall-cleanup';
import { detectRoomRegions, type RoomRegion } from './detect-room-regions';
import { assignMeasuredThickness, classifyWallThickness } from './wall-thickness';
import { zonesFromRooms, type RoomBox } from './zones-from-rooms';
import { reliableScale } from './reliable-scale';
import { credibleDoorArc, observedDoorArc } from './door-arc-geometry';
import { apertureCatalogId, apertureWidthLimits, leafWithoutArc, type ApertureVariant } from './aperture-types';

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
  /**
   * Proporción alto/ancho de la IMAGEN medida. Con muros de píxeles, el
   * aspecto del plano sale de aquí (dato) y no de la estimación de metros del
   * modelo (conjetura que deformaba el plano).
   */
  imageHeightOverWidth?: number;
  /**
   * Estrategia de zonificación. `regions` (por defecto): estancias = espacios
   * cerrados entre muros medidos (bocetos). `rooms`: estancias = cajas del
   * modelo ancladas a los muros medidos, creando los tabiques que falten
   * (planos dibujados, donde el modelo sitúa bien cada estancia).
   */
  zoneStrategy?: 'regions' | 'rooms';
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

// Una abertura nunca ocupa más que esta fracción de su muro.
const MAX_APERTURE_WALL_RATIO = 0.8;
// Mínimo de muros detectados por píxeles para fiarse de ellos (menos = la
// imagen no era un plano limpio y se cae a los muros del modelo).
const MIN_OVERRIDE_WALLS = 4;
// Hueco máximo (unidades de imagen) que se puentea entre tramos colineales
// detectados por píxeles. Amplio: una ventana puede partir la banda y dejar
// además un tramito corto descartado — el hueco combinado supera el vano
// nominal. El desvío lateral acotado evita fusionar muros paralelos reales.
const MAX_BRIDGE_GAP = 0.24;
// Para DETECTAR HABITACIONES se sella aún más: un boquete residual en el
// perímetro fugaría el flood fill y colapsaría todo a una sola estancia.
const SEAL_BRIDGE_GAP = 0.35;
// Dos aberturas del mismo muro a menos de esta distancia son la misma (duplicado del modelo).
const MIN_APERTURE_GAP_MM = 400;

/** Convierte la extracción cruda de un boceto en un plano métrico normalizado. */
export function normalizeSketch(
  raw: RawSketch,
  options: Partial<NormalizeOptions> = {},
): Plano2dPayload {
  return normalizeSketchDetailed(raw, options).plano;
}

export interface NormalizedSketch {
  plano: Plano2dPayload;
  /** Escala imagen→mm aplicada (la necesita quien proyecte más datos de la imagen: mobiliario, cotas). */
  scale: { mmPerUnitX: number; mmPerUnitY: number };
}

/** Igual que `normalizeSketch`, devolviendo además la escala imagen→mm. */
/** Muros medidos y limpios, huecos, semillas de abertura y escala: base común de las dos reconstrucciones. */
export interface PreparedSketch {
  opts: NormalizeOptions;
  /** Trazos estructurales leídos por visión, útiles si el raster pierde una fachada rayada. */
  modelWalls: SketchWall[];
  /** Muros limpios en unidades de imagen (medidos por píxeles o del modelo). */
  walls: SketchWall[];
  /** Muros de origen sin limpiar (con grosor medido, si lo hay). */
  sourceWalls: SketchWall[];
  /** Huecos medidos entre tramos colineales (posición exacta de aberturas). */
  gaps: WallGap[];
  /** Aberturas del modelo con geometría absoluta. */
  seeds: ApertureSeed[];
  /** True si los muros vienen de la detección de píxeles. */
  fromPixels: boolean;
  scale: Scale;
}

/**
 * Primera mitad de la normalización: limpieza topológica de los muros
 * medidos, captura de huecos, semillas del modelo y escala. La segunda mitad
 * (zonas) difiere según la estrategia: regiones entre muros (bocetos) o
 * reconstrucción desde las estancias (`plan-from-rooms.ts`).
 */
export function prepareSketch(raw: RawSketch, options: Partial<NormalizeOptions> = {}): PreparedSketch {
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };

  // Semillas de abertura con geometría ABSOLUTA antes de tocar los muros: los
  // índices del modelo dejan de valer tras filtrar/fusionar segmentos.
  // Una corredera, una plegable o una de dos hojas se reconocen por su hoja: no se les exigen los puntos del arco.
  const seeds = raw.aberturas
    .filter((a) => a.tipo !== 'puerta' || raw.habitaciones.length < 4 || leafWithoutArc(a.variante) ||
      credibleDoorArc(a, raw.aberturas, raw.muros, opts.imageHeightOverWidth))
    .map((a) => apertureSeed(a, raw.muros, opts.imageHeightOverWidth))
    .filter((s): s is ApertureSeed => s !== null);

  const fromPixels = (opts.wallsOverride?.length ?? 0) >= MIN_OVERRIDE_WALLS;
  const sourceWalls = fromPixels ? opts.wallsOverride! : raw.muros;

  let walls = sourceWalls.filter((w) => segmentLength(w) >= opts.minWallLength);
  walls = alignToGrid(walls, opts);
  walls = collapseDoubleWalls(walls, opts.snapDistance * 1.5, opts.angleToleranceDeg);
  walls = mergeCollinear(walls, opts.angleToleranceDeg, opts.snapDistance);
  let gaps: WallGap[] = [];
  if (fromPixels) {
    // Los vanos de puerta/ventana parten un muro detectado por píxeles en
    // tramos colineales con hueco: se puentean CAPTURANDO cada hueco — es la
    // posición EXACTA de una abertura (el modelo solo decidirá el tipo).
    const bridged = bridgeCollinearGaps(walls, opts.angleToleranceDeg, MAX_BRIDGE_GAP, opts.snapDistance);
    walls = bridged.walls;
    gaps = bridged.gaps;
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
  // Grupitos de trazos que se tocan entre sí pero no conectan con la red de
  // muros: iconos de mobiliario (fregadero, fogones) dibujados en el plano.
  walls = dropSmallComponents(walls, 0.25, opts.snapDistance);
  // La limpieza puede colapsar un muro corto en un punto: sin dirección, fuera.
  walls = walls.filter((w) => segmentLength(w) > 0);

  return { opts, modelWalls: raw.muros, walls, sourceWalls, gaps, seeds, fromPixels, scale: resolveScale(raw, walls, opts) };
}

export function normalizeSketchDetailed(
  raw: RawSketch,
  options: Partial<NormalizeOptions> = {},
): NormalizedSketch {
  const prepared = prepareSketch(raw, options);
  const { opts, sourceWalls, gaps, seeds, fromPixels, scale } = prepared;
  let walls = prepared.walls;

  // Estancias del modelo ancladas a los muros medidos: los tabiques que el
  // raster no vio se añaden ANTES de anclar aberturas y repartir (la escala ya
  // está resuelta: los tabiques añadidos caen dentro de la caja de muros medida).
  const roomsFirst = opts.zoneStrategy === 'rooms' && fromPixels && raw.habitaciones.length > 0;
  let roomBoxes: RoomBox[] = [];
  if (roomsFirst) {
    const guide = {
      mmPerUnitX: scale.mmPerUnitX,
      mmPerUnitY: scale.mmPerUnitY,
      thicknessUnit: opts.wallThicknessMm / ((scale.mmPerUnitX + scale.mmPerUnitY) / 2),
    };
    const zoning = zonesFromRooms(raw.habitaciones, walls, opts.snapDistance, guide);
    roomBoxes = zoning.rooms;
    walls = [...walls, ...zoning.addedWalls];
  }
  // Grosor por clase (fachada/tabique) desde las bandas medidas; la limpieza
  // creó segmentos nuevos, así que se reasigna por solape al final.
  const thicknessesMm = wallThicknessesMm(walls, sourceWalls, scale, opts, fromPixels);
  const planWalls = walls.map((w, i) => toPlanWall(w, i, scale, thicknessesMm[i]!));

  // Con muros medidos, las aberturas salen de los HUECOS detectados (posición
  // exacta); las semillas del modelo solo aportan el tipo. Sin medición, las
  // semillas del modelo son la única fuente.
  const finalSeeds = fromPixels ? seedsFromGaps(gaps, seeds, walls) : seeds;
  const apertures = anchorApertures(finalSeeds, walls, planWalls, scale, opts);
  const dimByWallId = buildDimensions(planWalls, opts);

  // Con muros medidos, las habitaciones son los espacios CERRADOS entre muros
  // (flood fill); los nombres del modelo se asignan a la región que los
  // contiene. Sin medición, se usan los polígonos del modelo tal cual.
  const thicknessUnit = opts.wallThicknessMm / ((scale.mmPerUnitX + scale.mmPerUnitY) / 2);
  // Solo para buscar habitaciones: sellado extra de boquetes residuales (un
  // leak en el perímetro haría "exterior" todo el interior y no habría zonas).
  const sealedWalls = fromPixels
    ? bridgeCollinearGaps(walls, opts.angleToleranceDeg, SEAL_BRIDGE_GAP, opts.snapDistance).walls
    : walls;
  const zones = roomsFirst
    ? buildZonesFromRoomBoxes(roomBoxes, planWalls, apertures, dimByWallId, scale, opts.snapDistance)
    : fromPixels
    ? buildZonesFromRegions(
        detectRoomRegions(sealedWalls, thicknessUnit),
        raw,
        planWalls,
        apertures,
        dimByWallId,
        scale,
      )
    : buildZones(raw, planWalls, apertures, dimByWallId, scale);

  return { plano: { schemaVersion: 1, zones }, scale };
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

export interface Scale {
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
  // Escala FIABLE (cotas escritas o escala gráfica): el ancho/alto declarados
  // son los del PLANO DIBUJADO, no los de la imagen. Se ajusta la caja de los
  // muros a esas medidas y no se aplica ningún saneo de plausibilidad.
  if (raw.escalaFiable === true && (raw.anchoMetros ?? raw.altoMetros) !== undefined && walls.length > 0) {
    const xs = walls.flatMap((w) => [w.x1, w.x2]);
    const ys = walls.flatMap((w) => [w.y1, w.y2]);
    const roomPoints = raw.habitaciones.flatMap((room) => room.poligono);
    const roomXs = roomPoints.map((point) => point.x);
    const roomYs = roomPoints.map((point) => point.y);
    const wallSpanX = Math.max(...xs) - Math.min(...xs);
    const wallSpanY = Math.max(...ys) - Math.min(...ys);
    const roomSpanX = roomXs.length ? Math.max(...roomXs) - Math.min(...roomXs) : 0;
    const roomSpanY = roomYs.length ? Math.max(...roomYs) - Math.min(...roomYs) : 0;
    // Las líneas de cota y los títulos pueden entrar como falsos muros. Si
    // rebasan claramente el perímetro de las estancias, anclar la escala a
    // la caja de muros encogería la planta al llevarla al editor.
    const spanX = roomSpanX > 0.2 && wallSpanX > roomSpanX * 1.08 ? roomSpanX : wallSpanX;
    const spanY = roomSpanY > 0.2 && wallSpanY > roomSpanY * 1.08 ? roomSpanY : wallSpanY;
    const reliable = reliableScale(raw, spanX, spanY, opts.imageHeightOverWidth);
    if (reliable) return reliable;
  }
  const widthM = raw.anchoMetros ?? opts.fallbackWidthMeters;
  // Con la proporción real de la imagen (muros medidos), el alto se DERIVA del
  // ancho: usar el alto estimado por el modelo deformaba la relación de aspecto.
  const heightM =
    opts.imageHeightOverWidth !== undefined
      ? widthM * opts.imageHeightOverWidth
      : (raw.altoMetros ?? widthM);
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

/**
 * Grosor final (mm) de cada muro limpio. Con muros medidos, el grosor de banda
 * se proyecta a mm por el eje PERPENDICULAR al muro y se agrupa en clases; sin
 * medición todos llevan el grosor por defecto.
 */
export function wallThicknessesMm(
  walls: SketchWall[],
  measured: SketchWall[],
  scale: Scale,
  opts: NormalizeOptions,
  fromPixels: boolean,
): number[] {
  if (!fromPixels) return walls.map(() => opts.wallThicknessMm);
  const assigned = assignMeasuredThickness(walls, measured, opts.snapDistance, opts.angleToleranceDeg);
  const measuredMm = assigned.map((w) => {
    if (w.thickness === undefined) return undefined;
    const orientation = orientationOf(w, opts.angleToleranceDeg);
    const mmPerUnit =
      orientation === 'h' ? scale.mmPerUnitY
      : orientation === 'v' ? scale.mmPerUnitX
      : (scale.mmPerUnitX + scale.mmPerUnitY) / 2;
    return w.thickness * mmPerUnit;
  });
  return classifyWallThickness(measuredMm, opts.wallThicknessMm);
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

export interface ApertureSeed {
  tipo: PlanAperture['kind'];
  /** Centro de la abertura en coordenadas de imagen. */
  center: SketchPoint;
  /** Ancho en unidades de imagen (a lo largo del muro), si el modelo lo dio. */
  widthUnit?: number;
  /** Giro y bisagra referidos a la dirección del muro leído por visión. */
  swing?: PlanAperture['swing'];
  hinge?: PlanAperture['hinge'];
  arcVisible?: boolean;
  observedArc?: boolean;
  sourceDirection?: SketchPoint;
  /** Carpintería leída en el símbolo (entrada, doble hoja, corredera…). */
  variante?: ApertureVariant;
}

/** Geometría absoluta de una abertura a partir del muro crudo que referencia. */
function apertureSeed(a: SketchAperture, rawWalls: SketchWall[], imageHeightOverWidth = 1): ApertureSeed | null {
  const w = rawWalls[a.muro];
  if (!w) return null;
  const len = segmentLength(w);
  if (len <= 0) return null;
  const observed = observedDoorArc(a, imageHeightOverWidth);
  return {
    tipo: a.tipo,
    center: observed?.center ?? {
      x: w.x1 + (w.x2 - w.x1) * a.posicion,
      y: w.y1 + (w.y2 - w.y1) * a.posicion,
    },
    ...(observed ? { widthUnit: observed.widthUnit } : a.anchoSobreMuro ? { widthUnit: a.anchoSobreMuro * len } : {}),
    ...(observed ? { swing: observed.swing, hinge: observed.hinge } :
      a.tipo === 'puerta' ? { ...(a.swing ? { swing: a.swing } : {}), ...(a.hinge ? { hinge: a.hinge } : {}) } : {}),
    ...(a.tipo === 'puerta' && a.arcVisible ? { arcVisible: true } : {}),
    ...(observed ? { observedArc: true } : {}),
    ...(a.variante ? { variante: a.variante } : {}),
    sourceDirection: observed?.sourceDirection ?? { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len },
  };
}

/**
 * Ancla cada semilla al muro FINAL más cercano (proyección perpendicular).
 * Descarta las que quedan lejos de todo muro y deduplica las que caen casi en
 * el mismo punto del mismo muro (el modelo repite aberturas con frecuencia).
 */
export function anchorApertures(
  seeds: ApertureSeed[],
  walls: SketchWall[],
  planWalls: PlanWall[],
  scale: Scale,
  opts: NormalizeOptions,
  maxPerp = opts.snapDistance * 2,
): PlanAperture[] {
  const out: PlanAperture[] = [];

  for (const seed of seeds) {
    let best: { wall: PlanWall; t: number; score: number; dx: number; dy: number } | null = null;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i]!;
      const len = segmentLength(w);
      if (len <= 0) continue;
      const dx = (w.x2 - w.x1) / len;
      const dy = (w.y2 - w.y1) / len;
      // Una puerta leída sobre un muro vertical no puede saltar al tramo
      // horizontal vecino al resolver una unión en T.
      if (seed.sourceDirection && Math.abs(seed.sourceDirection.x * dx + seed.sourceDirection.y * dy) < 0.9) continue;
      const relX = seed.center.x - w.x1;
      const relY = seed.center.y - w.y1;
      const t = (relX * dx + relY * dy) / len;
      if (t < -0.1 || t > 1.1) continue;
      const perp = Math.abs(relX * -dy + relY * dx);
      if (perp > maxPerp) continue;
      // Cerca del extremo compartido, gana el tramo que contiene el centro
      // antes que otro igual de paralelo al que habría que proyectarlo.
      const overhang = Math.max(0, -t, t - 1) * len;
      const score = perp + overhang;
      if (!best || score < best.score) best = { wall: planWalls[i]!, t, score, dx, dy };
    }
    if (!best) continue; // Lejos de todo muro: era ruido o su muro se descartó.

    const lengthMm = wallLengthMm(best.wall);
    if (lengthMm <= 0) continue;
    // Ancho en mm: la semilla trae el ancho en unidades de imagen; se proyecta
    // con la escala media (las aberturas viven sobre muros casi axis-aligned).
    const limits = apertureWidthLimits(seed.tipo, seed.variante);
    const requested = seed.widthUnit
      ? seed.widthUnit * ((scale.mmPerUnitX + scale.mmPerUnitY) / 2)
      : limits.defaultMm;
    // Acotado por plausibilidad del tipo: un "hueco" de 2,5 m es una banda mal
    // partida, no una puerta — la abertura se centra con un ancho creíble.
    const widthMm = Math.round(
      Math.min(requested, limits.maxMm, lengthMm * MAX_APERTURE_WALL_RATIO),
    );
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

    const reversed = seed.sourceDirection &&
      seed.sourceDirection.x * best.dx + seed.sourceDirection.y * best.dy < 0;
    const flip = (side: 'left' | 'right') => side === 'left' ? 'right' : 'left';
    const catalogId = apertureCatalogId(seed.tipo, seed.variante, widthMm);
    out.push({
      id: `a${out.length}`, kind: seed.tipo, wallId: best.wall.id, position, widthMm,
      ...(seed.swing ? { swing: reversed ? flip(seed.swing) : seed.swing } : {}),
      ...(seed.hinge ? { hinge: reversed ? flip(seed.hinge) : seed.hinge } : {}),
      ...(catalogId ? { catalogId } : {}),
    });
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Un hueco y una semilla del modelo a menos de esto son la misma abertura.
const GAP_MATCH_DIST = 0.08;
// Distancia al borde del plano por debajo de la cual un hueco sin tipo es ventana.
const PERIMETER_TOL = 0.05;

/** Convierte huecos medidos en aberturas; conserva ventanas exteriores sin hueco. */
export function seedsFromGaps(
  gaps: WallGap[],
  modelSeeds: ApertureSeed[],
  walls: SketchWall[],
  unmatchedInteriorKind: 'puerta' | 'hueco' = 'puerta',
): ApertureSeed[] {
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const ys = walls.flatMap((w) => [w.y1, w.y2]);
  const nearPerimeter = (p: SketchPoint) =>
    xs.length > 0 &&
    (Math.min(p.x - Math.min(...xs), Math.max(...xs) - p.x) <= PERIMETER_TOL ||
      Math.min(p.y - Math.min(...ys), Math.max(...ys) - p.y) <= PERIMETER_TOL);
  const dist = (a: SketchPoint, b: SketchPoint) => Math.hypot(a.x - b.x, a.y - b.y);

  const out: ApertureSeed[] = gaps.map((gap) => {
    const near = modelSeeds
      .filter((s) => dist(s.center, gap.center) <= GAP_MATCH_DIST)
      .sort((a, b) => dist(a.center, gap.center) - dist(b.center, gap.center))[0];
    const aligned = !near?.sourceDirection || !gap.direction ||
      Math.abs(near.sourceDirection.x * gap.direction.x + near.sourceDirection.y * gap.direction.y) >= 0.9;
    return {
      tipo: (aligned ? near?.tipo : undefined) ?? (nearPerimeter(gap.center) ? 'ventana' : unmatchedInteriorKind),
      center: gap.center,
      widthUnit: gap.width,
      ...(aligned && near?.swing ? { swing: near.swing } : {}),
      ...(aligned && near?.hinge ? { hinge: near.hinge } : {}),
      ...(aligned && near?.variante ? { variante: near.variante } : {}),
      ...(gap.direction ? { sourceDirection: gap.direction } : near?.sourceDirection ? { sourceDirection: near.sourceDirection } : {}),
    };
  });
  for (const seed of modelSeeds) {
    if (seed.tipo !== 'ventana') continue;
    if (gaps.some((g) => dist(g.center, seed.center) <= GAP_MATCH_DIST)) continue;
    // Una ventana sin hueco medido solo es creíble en el PERÍMETRO: una
    // "ventana" en mitad de un tabique interior es alucinación del modelo.
    if (!nearPerimeter(seed.center)) continue;
    out.push(seed);
  }
  return out;
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
export function buildDimensions(
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
  return distributeContent(zones, planWalls, apertures, dimByWallId);
}

/**
 * Zonas desde las REGIONES medidas (flood fill entre muros): el contorno y la
 * superficie salen de la geometría real, no de los polígonos aproximados del
 * modelo. Los nombres del modelo se asignan a la región que contiene su
 * centroide; una región con varios nombres (espacio abierto salón-cocina) se
 * parte en franjas para que cada nombre tenga su sitio.
 */
function buildZonesFromRegions(
  regions: RoomRegion[],
  raw: RawSketch,
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  dimByWallId: Map<string, PlanDimension>,
  scale: Scale,
): PlanZone[] {
  if (regions.length === 0) {
    return buildZones({ ...raw, habitaciones: [] }, planWalls, apertures, dimByWallId, scale);
  }

  // Nombre del modelo → región que contiene su centroide (o la más cercana).
  const anchorsByRegion = new Map<number, Array<{ name: string; anchor: SketchPoint }>>();
  for (const room of raw.habitaciones) {
    const c = unitCentroid(room.poligono);
    let idx = regions.findIndex(
      (r) => c.x >= r.bbox.minX && c.x <= r.bbox.maxX && c.y >= r.bbox.minY && c.y <= r.bbox.maxY,
    );
    if (idx < 0) idx = nearestRegion(c, regions);
    const list = anchorsByRegion.get(idx) ?? [];
    list.push({ name: room.nombre, anchor: c });
    anchorsByRegion.set(idx, list);
  }

  const zones: PlanZone[] = [];
  regions.forEach((region, i) => {
    const named = anchorsByRegion.get(i) ?? [];
    for (const slice of sliceRegion(region, named)) {
      zones.push({
        id: `z${zones.length}`,
        name: slice.name,
        outline: [
          toMm({ x: slice.minX, y: slice.minY }, scale),
          toMm({ x: slice.maxX, y: slice.minY }, scale),
          toMm({ x: slice.maxX, y: slice.maxY }, scale),
          toMm({ x: slice.minX, y: slice.maxY }, scale),
        ],
        walls: [],
        apertures: [],
        dimensions: [],
      });
    }
  });
  return distributeContent(zones, planWalls, apertures, dimByWallId);
}

/**
 * Zonas desde las cajas de estancia ancladas (planos dibujados). El contorno
 * es la cara INTERIOR: cada lado de la caja retrocede medio grosor del muro
 * que hay sobre esa línea (fachada gruesa o tabique fino), igual que el de las
 * regiones: así la medida de la zona es la luz entre caras, que es lo que las
 * cotas escritas expresan. Una zona por estancia del modelo, en su orden.
 */
function buildZonesFromRoomBoxes(
  rooms: RoomBox[],
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  dimByWallId: Map<string, PlanDimension>,
  scale: Scale,
  snap: number,
): PlanZone[] {
  const zones: PlanZone[] = rooms.map((room, i) => {
    const box = {
      minX: room.minX * scale.mmPerUnitX,
      maxX: room.maxX * scale.mmPerUnitX,
      minY: room.minY * scale.mmPerUnitY,
      maxY: room.maxY * scale.mmPerUnitY,
    };
    const halfAt = (axis: 'x' | 'y', value: number) =>
      sideWallThickness(planWalls, axis, value, axis === 'x' ? box.minY : box.minX, axis === 'x' ? box.maxY : box.maxX, snap * (axis === 'x' ? scale.mmPerUnitX : scale.mmPerUnitY)) / 2;
    const left = box.minX + halfAt('x', box.minX);
    const right = box.maxX - halfAt('x', box.maxX);
    const top = box.minY + halfAt('y', box.minY);
    const bottom = box.maxY - halfAt('y', box.maxY);
    const pt = (x: number, y: number): PlanPoint => ({ x: Math.round(x), y: Math.round(y) });
    return {
      id: `z${i}`,
      name: room.name,
      outline: [pt(left, top), pt(right, top), pt(right, bottom), pt(left, bottom)],
      walls: [],
      apertures: [],
      dimensions: [],
    };
  });
  if (zones.length === 0) {
    return [{ id: 'z0', name: 'Estancia', outline: outlineFromWalls(planWalls), walls: planWalls, apertures, dimensions: [...dimByWallId.values()] }];
  }
  return distributeContent(zones, planWalls, apertures, dimByWallId);
}

// Grosor asumido para un lado de estancia sin muro sobre su línea (límite lógico).
const DEFAULT_SIDE_THICKNESS_MM = 120;

/**
 * Grosor (mm) del muro que descansa sobre la línea `value` del eje dado y cuyo
 * recorrido toca el lado [spanLo, spanHi]; el más grueso si hay varios tramos.
 */
function sideWallThickness(
  walls: PlanWall[],
  axis: 'x' | 'y',
  value: number,
  spanLo: number,
  spanHi: number,
  toleranceMm: number,
): number {
  let best = 0;
  for (const w of walls) {
    const perpendicular = axis === 'x' ? w.from.x === w.to.x : w.from.y === w.to.y;
    if (!perpendicular) continue;
    const at = axis === 'x' ? w.from.x : w.from.y;
    if (Math.abs(at - value) > toleranceMm) continue;
    const [lo, hi] = axis === 'x'
      ? [Math.min(w.from.y, w.to.y), Math.max(w.from.y, w.to.y)]
      : [Math.min(w.from.x, w.to.x), Math.max(w.from.x, w.to.x)];
    if (Math.min(hi, spanHi) - Math.max(lo, spanLo) <= 0) continue;
    best = Math.max(best, w.thicknessMm);
  }
  return best > 0 ? best : DEFAULT_SIDE_THICKNESS_MM;
}

interface RegionSlice {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Parte la caja de una región entre sus nombres: franjas por el eje donde los
 * anclajes se separan más, cortadas en los puntos medios. Sin nombres, la
 * región entera queda como "Estancia".
 */
function sliceRegion(
  region: RoomRegion,
  named: Array<{ name: string; anchor: SketchPoint }>,
): RegionSlice[] {
  const { bbox } = region;
  if (named.length === 0) return [{ name: 'Estancia', ...bbox }];
  if (named.length === 1) return [{ name: named[0]!.name, ...bbox }];

  const spreadX = Math.max(...named.map((n) => n.anchor.x)) - Math.min(...named.map((n) => n.anchor.x));
  const spreadY = Math.max(...named.map((n) => n.anchor.y)) - Math.min(...named.map((n) => n.anchor.y));
  const axis: 'x' | 'y' = spreadX >= spreadY ? 'x' : 'y';
  const sorted = [...named].sort((a, b) => a.anchor[axis] - b.anchor[axis]);

  const lo = axis === 'x' ? bbox.minX : bbox.minY;
  const hi = axis === 'x' ? bbox.maxX : bbox.maxY;
  return sorted.map((n, i) => {
    const from = i === 0 ? lo : (sorted[i - 1]!.anchor[axis] + n.anchor[axis]) / 2;
    const to = i === sorted.length - 1 ? hi : (n.anchor[axis] + sorted[i + 1]!.anchor[axis]) / 2;
    return axis === 'x'
      ? { name: n.name, minX: from, maxX: to, minY: bbox.minY, maxY: bbox.maxY }
      : { name: n.name, minX: bbox.minX, maxX: bbox.maxX, minY: from, maxY: to };
  });
}

function unitCentroid(points: SketchPoint[]): SketchPoint {
  const n = Math.max(1, points.length);
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

function nearestRegion(p: SketchPoint, regions: RoomRegion[]): number {
  let best = 0;
  let bestDist = Infinity;
  regions.forEach((r, i) => {
    const d = Math.hypot(p.x - r.centroid.x, p.y - r.centroid.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Reparte muros, cotas y aberturas entre zonas por cercanía de centroides. */
function distributeContent(
  zones: PlanZone[],
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  dimByWallId: Map<string, PlanDimension>,
): PlanZone[] {
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
