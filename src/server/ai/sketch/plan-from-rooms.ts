/**
 * Reconstrucción del plano DESDE LAS ESTANCIAS (planos dibujados).
 *
 * En un plano dibujado el modelo de visión sitúa bien cada estancia (polígono
 * + nombre + medidas escritas). Aquí las estancias SON el plano: cada polígono
 * se posa sobre una rejilla global de líneas (una por coordenada compartida
 * entre estancias, afinada con los muros medidos por píxeles) y los muros son
 * las aristas de esos polígonos. Por construcción el resultado es un complejo
 * cerrado y consistente: no hay muros sueltos, ni tabiques que no llegan, ni
 * bordes de terraza convertidos en muro. El raster sólo aporta la posición
 * exacta de las líneas, los huecos (aberturas) y el grosor por clase; el
 * modelo aporta la topología. Puro y sin IA.
 */
import type {
  PlanAperture,
  PlanImportWarning,
  PlanPoint,
  PlanWall,
  PlanZone,
  Plano2dPayload,
} from '@/lib/contracts';
import type { SketchPoint, SketchRoom, SketchWall } from './sketch-types';
import {
  anchorApertures,
  seedsFromGaps,
  type PreparedSketch,
  type Scale,
} from './normalize-geometry';
import { assignMeasuredThickness, classifyWallThickness } from './wall-thickness';

export interface RoomsPlan {
  plano: Plano2dPayload;
  warnings: PlanImportWarning[];
  /**
   * Muros medidos partidos donde atraviesan un vacío INTERIOR (pasillo sin
   * estancia leída): sirven al solver de cotas para decidir qué tramos
   * colineales son el mismo muro físico. Un retranqueo de fachada une tramos;
   * un pasillo entre dos filas de estancias no (sus cotas pueden discrepar).
   */
  lineHints: SketchWall[];
  /** Diagnóstico: rejilla y polígonos posados (unidades de imagen). */
  debug: {
    gridX: GridLine[];
    gridY: GridLine[];
    polygons: Array<{ name: string; points: SketchPoint[] }>;
  };
}

// Si la caja del polígono leído supera la medida escrita en más de esto, el
// modelo anexó a la estancia un trozo de otra (pasillo, armario): se toma el
// mayor rectángulo inscrito en el polígono.
const MAX_BOX_OVER_COTA = 0.12;

type Axis = 'x' | 'y';

// Vértices de estancia a menos de esto (unidades de imagen) comparten línea.
const CLUSTER_TOL = 0.012;
// Una línea de estancias se posa sobre un muro medido a menos de esto.
const SNAP_WINDOW = 0.03;
// Lado mínimo de una estancia creíble (unidades de imagen).
const MIN_SIDE = 0.02;
// Desplazamiento (unidades de imagen) para sondear a qué lado de un muro hay estancia.
const PROBE = 0.004;

interface Poly {
  room: SketchRoom;
  /** Polígono completo posado en la rejilla: define los muros. */
  points: SketchPoint[];
  /** Cuerpo de la estancia para medir (rectángulo principal si el modelo le anexó un trozo ajeno). */
  body: SketchPoint[];
}

/** Segmento elemental de muro sobre una línea de la rejilla. */
interface Segment {
  axis: Axis;
  value: number;
  lo: number;
  hi: number;
  /** Índices (en `polys`) de las estancias con una arista sobre este tramo. */
  owners: number[];
  exterior: boolean;
  thicknessMm: number;
}

/** Reconstruye muros, aberturas y zonas a partir de las estancias del modelo. */
export function buildPlanFromRooms(rooms: SketchRoom[], prepared: PreparedSketch): RoomsPlan {
  const { opts, scale } = prepared;
  const warnings: PlanImportWarning[] = [];

  const gridX = buildGrid(rooms, prepared.walls, 'x');
  const gridY = buildGrid(rooms, prepared.walls, 'y');

  const polys: Poly[] = [];
  for (const room of rooms) {
    const points = snapPolygon(room.poligono, gridX, gridY);
    if (points === null) {
      warnings.push({
        code: 'zona-exterior-sin-contorno',
        message: `«${room.nombre}»: el contorno leído es demasiado pequeño o degenerado; no se reconstruye.`,
      });
      continue;
    }
    const body = snapPolygon(trimToWrittenSize(room, scale), gridX, gridY) ?? points;
    polys.push({ room, points, body });
  }

  const segments = elementarySegments(polys);
  classifySegments(segments, polys, prepared, scale);

  const wallSegments = segments.filter((s) => s.owners.some((i) => polys[i]!.room.exterior !== true));
  const unitWalls: SketchWall[] = wallSegments.map((s) =>
    s.axis === 'x'
      ? { x1: s.value, y1: s.lo, x2: s.value, y2: s.hi }
      : { x1: s.lo, y1: s.value, x2: s.hi, y2: s.value },
  );
  const planWalls: PlanWall[] = wallSegments.map((s, i) => ({
    id: `w${i}`,
    from: toMm(unitWalls[i]!.x1, unitWalls[i]!.y1, scale),
    to: toMm(unitWalls[i]!.x2, unitWalls[i]!.y2, scale),
    thicknessMm: s.thicknessMm,
  }));

  // Aberturas: huecos medidos (posición exacta, tipados por el modelo) más las
  // aberturas del modelo que no coinciden con ninguna ya anclada en el mismo
  // muro (una puerta dibujada con su hoja no abre hueco en el raster). Las
  // ventanas sólo son creíbles en fachada.
  const exteriorWallIds = new Set(planWalls.filter((_, i) => wallSegments[i]!.exterior).map((w) => w.id));
  const fromGaps = prepared.fromPixels ? seedsFromGaps(prepared.gaps, prepared.seeds, prepared.walls) : [];
  const anchoredGaps = anchorApertures(fromGaps, unitWalls, planWalls, scale, opts);
  const anchoredModel = anchorApertures(prepared.seeds, unitWalls, planWalls, scale, opts);
  const apertures = mergeApertures(anchoredGaps, anchoredModel, planWalls).filter(
    (a) => a.kind !== 'ventana' || exteriorWallIds.has(a.wallId),
  );

  // Sin cotas importadas: el editor acota en vivo y las del plano sólo estorbaban.
  const zones = buildZones(polys, wallSegments, planWalls, apertures, scale);
  return {
    plano: { schemaVersion: 1, zones },
    warnings,
    lineHints: splitAtInteriorVoids(prepared.walls, polys),
    debug: { gridX, gridY, polygons: polys.map((p) => ({ name: p.room.nombre, points: p.points })) },
  };
}

/**
 * Cuerpo de la estancia para MEDIR. Si tiene medidas escritas y la caja del
 * polígono las supera con claridad, el modelo le anexó un trozo ajeno (armario,
 * tramo de pasillo): el cuerpo es el mayor rectángulo inscrito. El polígono
 * completo sigue definiendo los muros, así no quedan huecos sin dueño.
 */
function trimToWrittenSize(room: SketchRoom, scale: Scale): SketchPoint[] {
  const polygon = room.poligono;
  if (polygon.length <= 4 || (room.anchoMetros === undefined && room.altoMetros === undefined)) return polygon;
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const boxW = (Math.max(...xs) - Math.min(...xs)) * scale.mmPerUnitX;
  const boxH = (Math.max(...ys) - Math.min(...ys)) * scale.mmPerUnitY;
  const overW = room.anchoMetros !== undefined && boxW > room.anchoMetros * 1000 * (1 + MAX_BOX_OVER_COTA);
  const overH = room.altoMetros !== undefined && boxH > room.altoMetros * 1000 * (1 + MAX_BOX_OVER_COTA);
  if (!overW && !overH) return polygon;
  const best = largestInscribedRectangle(polygon);
  return best ?? polygon;
}

/** Mayor rectángulo alineado con los ejes contenido en un polígono rectilíneo (rejilla de sus vértices). */
function largestInscribedRectangle(polygon: SketchPoint[]): SketchPoint[] | null {
  const xs = [...new Set(polygon.map((p) => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(polygon.map((p) => p.y))].sort((a, b) => a - b);
  let best: { area: number; x0: number; x1: number; y0: number; y1: number } | null = null;
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++)
      for (let k = 0; k < ys.length; k++)
        for (let l = k + 1; l < ys.length; l++) {
          const x0 = xs[i]!, x1 = xs[j]!, y0 = ys[k]!, y1 = ys[l]!;
          const area = (x1 - x0) * (y1 - y0);
          if (best && area <= best.area) continue;
          // Todas las celdas de la rejilla dentro del candidato deben caer en el polígono.
          let inside = true;
          for (let a = i; a < j && inside; a++)
            for (let b = k; b < l && inside; b++) {
              const c = { x: (xs[a]! + xs[a + 1]!) / 2, y: (ys[b]! + ys[b + 1]!) / 2 };
              if (!pointInPolygon(c, polygon)) inside = false;
            }
          if (inside) best = { area, x0, x1, y0, y1 };
        }
  if (!best) return null;
  return [
    { x: best.x0, y: best.y0 },
    { x: best.x1, y: best.y0 },
    { x: best.x1, y: best.y1 },
    { x: best.x0, y: best.y1 },
  ];
}

// ── Rejilla global de líneas ─────────────────────────────────────────────────

interface GridLine {
  /** Coordenada final (posada sobre un muro medido si lo hay). */
  value: number;
  /** Rango de coordenadas leídas que caen en esta línea. */
  min: number;
  max: number;
}

interface MeasuredLine {
  value: number;
  lo: number;
  hi: number;
}

/**
 * Agrupa las coordenadas de todos los vértices de estancia del eje en líneas
 * (tolerancia `CLUSTER_TOL`) y posa cada una sobre el muro medido más cercano
 * cuyo recorrido solapa con los vértices que la forman.
 */
function buildGrid(rooms: SketchRoom[], measuredWalls: SketchWall[], axis: Axis): GridLine[] {
  const perpAxis: Axis = axis === 'x' ? 'y' : 'x';
  const vertices = rooms
    .flatMap((r) => r.poligono)
    .map((p) => ({ coord: p[axis], perp: p[perpAxis] }))
    .sort((a, b) => a.coord - b.coord);
  const clusters: Array<{ sum: number; n: number; min: number; max: number; perpLo: number; perpHi: number }> = [];
  for (const v of vertices) {
    const last = clusters[clusters.length - 1];
    if (last && v.coord - last.sum / last.n <= CLUSTER_TOL) {
      last.sum += v.coord;
      last.n++;
      last.max = v.coord;
      last.perpLo = Math.min(last.perpLo, v.perp);
      last.perpHi = Math.max(last.perpHi, v.perp);
    } else {
      clusters.push({ sum: v.coord, n: 1, min: v.coord, max: v.coord, perpLo: v.perp, perpHi: v.perp });
    }
  }
  const measured = measuredLines(measuredWalls, axis);
  return clusters.map((c) => {
    const mean = c.sum / c.n;
    let best: MeasuredLine | null = null;
    for (const line of measured) {
      const dist = Math.abs(line.value - mean);
      if (dist > SNAP_WINDOW) continue;
      if (Math.min(line.hi, c.perpHi) - Math.max(line.lo, c.perpLo) < -SNAP_WINDOW) continue;
      if (!best || dist < Math.abs(best.value - mean)) best = line;
    }
    return { value: best?.value ?? mean, min: c.min, max: c.max };
  });
}

function measuredLines(walls: SketchWall[], axis: Axis): MeasuredLine[] {
  return walls
    .filter((w) => (axis === 'x' ? Math.abs(w.x1 - w.x2) < 1e-6 : Math.abs(w.y1 - w.y2) < 1e-6))
    .map((w) =>
      axis === 'x'
        ? { value: w.x1, lo: Math.min(w.y1, w.y2), hi: Math.max(w.y1, w.y2) }
        : { value: w.y1, lo: Math.min(w.x1, w.x2), hi: Math.max(w.x1, w.x2) },
    );
}

function snapCoord(grid: GridLine[], v: number): number {
  const inside = grid.find((g) => v >= g.min - 1e-9 && v <= g.max + 1e-9);
  if (inside) return inside.value;
  let best = grid[0]!;
  for (const g of grid) if (Math.abs(g.value - v) < Math.abs(best.value - v)) best = g;
  return best.value;
}

/**
 * Polígono posado en la rejilla, rectilíneo y sin puntos redundantes. Null si
 * queda degenerado (dos vértices en la misma línea lo aplastan).
 */
function snapPolygon(polygon: SketchPoint[], gridX: GridLine[], gridY: GridLine[]): SketchPoint[] | null {
  if (polygon.length < 3 || gridX.length === 0 || gridY.length === 0) return null;
  const snapped = polygon.map((p) => ({ x: snapCoord(gridX, p.x), y: snapCoord(gridY, p.y) }));
  // Aristas diagonales (el modelo no cerró bien una esquina): se convierten en L.
  const rectilinear: SketchPoint[] = [];
  snapped.forEach((p, i) => {
    const prev = rectilinear[rectilinear.length - 1] ?? snapped[(i + snapped.length - 1) % snapped.length]!;
    if (prev.x !== p.x && prev.y !== p.y) rectilinear.push({ x: p.x, y: prev.y });
    rectilinear.push(p);
  });
  const cleaned = dropRedundant(rectilinear);
  if (cleaned.length < 4) return null;
  const xs = cleaned.map((p) => p.x);
  const ys = cleaned.map((p) => p.y);
  if (Math.max(...xs) - Math.min(...xs) < MIN_SIDE || Math.max(...ys) - Math.min(...ys) < MIN_SIDE) return null;
  return cleaned;
}

/** Quita duplicados consecutivos y vértices colineales (incluido el cierre). */
function dropRedundant(points: SketchPoint[]): SketchPoint[] {
  let out = points.filter((p, i, arr) => {
    const prev = arr[(i + arr.length - 1) % arr.length]!;
    return !(prev.x === p.x && prev.y === p.y);
  });
  for (let pass = 0; pass < 2; pass++) {
    out = out.filter((p, i, arr) => {
      const prev = arr[(i + arr.length - 1) % arr.length]!;
      const next = arr[(i + 1) % arr.length]!;
      const collinear = (prev.x === p.x && p.x === next.x) || (prev.y === p.y && p.y === next.y);
      return !collinear;
    });
  }
  return out;
}

// ── Segmentos elementales ────────────────────────────────────────────────────

interface Edge {
  axis: Axis;
  value: number;
  lo: number;
  hi: number;
  owner: number;
}

/**
 * Parte cada arista de estancia en los puntos donde otra estancia tiene un
 * vértice sobre la misma línea (uniones en T) y funde los tramos idénticos de
 * estancias vecinas en un solo segmento con varios dueños.
 */
function elementarySegments(polys: Poly[]): Segment[] {
  const edges: Edge[] = [];
  polys.forEach((poly, owner) => {
    poly.points.forEach((a, i) => {
      const b = poly.points[(i + 1) % poly.points.length]!;
      if (a.x === b.x && a.y !== b.y) edges.push({ axis: 'x', value: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y), owner });
      else if (a.y === b.y && a.x !== b.x) edges.push({ axis: 'y', value: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), owner });
    });
  });
  // Puntos de corte por línea: todo vértice de cualquier estancia sobre ella.
  const cutsByLine = new Map<string, Set<number>>();
  const key = (axis: Axis, value: number) => `${axis}:${value}`;
  for (const poly of polys) {
    for (const p of poly.points) {
      for (const [axis, value, perp] of [['x', p.x, p.y], ['y', p.y, p.x]] as Array<[Axis, number, number]>) {
        const k = key(axis, value);
        if (!cutsByLine.has(k)) cutsByLine.set(k, new Set());
        cutsByLine.get(k)!.add(perp);
      }
    }
  }
  const segments = new Map<string, Segment>();
  for (const edge of edges) {
    const cuts = [...(cutsByLine.get(key(edge.axis, edge.value)) ?? [])]
      .filter((c) => c > edge.lo && c < edge.hi)
      .sort((a, b) => a - b);
    const stops = [edge.lo, ...cuts, edge.hi];
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i]!;
      const hi = stops[i + 1]!;
      if (hi - lo < 1e-9) continue;
      const k = `${edge.axis}:${edge.value}:${lo}:${hi}`;
      const existing = segments.get(k);
      if (existing) existing.owners.push(edge.owner);
      else segments.set(k, { axis: edge.axis, value: edge.value, lo, hi, owners: [edge.owner], exterior: false, thicknessMm: 0 });
    }
  }
  return [...segments.values()];
}

/**
 * Fachada o tabique. Manda el grosor MEDIDO cuando una banda del raster cae
 * sobre el tramo; sin medida, es fachada si a un lado no hay estancia interior
 * y ese lado queda fuera de la caja de las estancias interiores (un hueco
 * interior sin estancia leída —pasillo— sigue siendo tabique).
 */
function classifySegments(segments: Segment[], polys: Poly[], prepared: PreparedSketch, scale: Scale): void {
  const interior = polys.filter((p) => p.room.exterior !== true);
  const xs = interior.flatMap((p) => p.points.map((q) => q.x));
  const ys = interior.flatMap((p) => p.points.map((q) => q.y));
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const insideInterior = (p: SketchPoint) => interior.some((poly) => pointInPolygon(p, poly.points));
  const insideBox = (p: SketchPoint) =>
    p.x > box.minX + PROBE / 2 && p.x < box.maxX - PROBE / 2 && p.y > box.minY + PROBE / 2 && p.y < box.maxY - PROBE / 2;

  const { thin, thick } = thicknessClasses(prepared, scale);
  const unitWalls: SketchWall[] = segments.map((s) =>
    s.axis === 'x' ? { x1: s.value, y1: s.lo, x2: s.value, y2: s.hi } : { x1: s.lo, y1: s.value, x2: s.hi, y2: s.value },
  );
  const measured = prepared.fromPixels
    ? assignMeasuredThickness(unitWalls, prepared.sourceWalls, prepared.opts.snapDistance, prepared.opts.angleToleranceDeg)
    : unitWalls;

  segments.forEach((s, i) => {
    const mid = s.axis === 'x' ? { x: s.value, y: (s.lo + s.hi) / 2 } : { x: (s.lo + s.hi) / 2, y: s.value };
    const sideA = s.axis === 'x' ? { x: mid.x - PROBE, y: mid.y } : { x: mid.x, y: mid.y - PROBE };
    const sideB = s.axis === 'x' ? { x: mid.x + PROBE, y: mid.y } : { x: mid.x, y: mid.y + PROBE };
    const open = [sideA, sideB].filter((p) => !insideInterior(p));
    s.exterior = open.some((p) => !insideBox(p));
    const t = measured[i]!.thickness;
    if (t !== undefined && thick !== thin) {
      const mmPerUnit = s.axis === 'x' ? scale.mmPerUnitX : scale.mmPerUnitY;
      const mm = t * mmPerUnit;
      s.thicknessMm = Math.abs(mm - thick) < Math.abs(mm - thin) ? thick : thin;
    } else {
      s.thicknessMm = s.exterior ? thick : thin;
    }
  });
}

/**
 * Vacío interior: punto fuera de toda estancia interior (a ambos lados del
 * muro) y ENCERRADO por estancias, es decir, sin salida recta al exterior en
 * ninguna de las cuatro direcciones (un pasillo sin estancia leída). Un
 * retranqueo de fachada tiene salida y no cuenta.
 */
function interiorVoidTester(polys: Poly[]): (p: SketchPoint, axis: Axis) => boolean {
  const interior = polys.filter((p) => p.room.exterior !== true);
  const xs = interior.flatMap((p) => p.points.map((q) => q.x));
  const ys = interior.flatMap((p) => p.points.map((q) => q.y));
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const insideInterior = (p: SketchPoint) => interior.some((poly) => pointInPolygon(p, poly.points));
  const step = PROBE * 2;
  const enclosed = (p: SketchPoint) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let blocked = false;
      for (let q = { x: p.x + dx * step, y: p.y + dy * step }; q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY; q = { x: q.x + dx * step, y: q.y + dy * step }) {
        if (insideInterior(q)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return false;
    }
    return true;
  };
  return (p, axis) => {
    const a = axis === 'x' ? { x: p.x - PROBE, y: p.y } : { x: p.x, y: p.y - PROBE };
    const b = axis === 'x' ? { x: p.x + PROBE, y: p.y } : { x: p.x, y: p.y + PROBE };
    if (insideInterior(a) || insideInterior(b)) return false;
    return enclosed(a) && enclosed(b);
  };
}

/** Parte cada muro medido en los tramos que NO atraviesan un vacío interior. */
function splitAtInteriorVoids(walls: SketchWall[], polys: Poly[]): SketchWall[] {
  const isVoid = interiorVoidTester(polys);
  const out: SketchWall[] = [];
  const step = PROBE * 2;
  for (const w of walls) {
    const axis: Axis | null = Math.abs(w.x1 - w.x2) < 1e-6 ? 'x' : Math.abs(w.y1 - w.y2) < 1e-6 ? 'y' : null;
    if (axis === null) continue;
    const value = axis === 'x' ? w.x1 : w.y1;
    const lo = axis === 'x' ? Math.min(w.y1, w.y2) : Math.min(w.x1, w.x2);
    const hi = axis === 'x' ? Math.max(w.y1, w.y2) : Math.max(w.x1, w.x2);
    // Muestras a paso fijo más el extremo final: un tramo sin vacío sale entero.
    const samples: number[] = [];
    for (let t = lo; t < hi; t += step) samples.push(t);
    samples.push(hi);
    let runStart: number | null = null;
    samples.forEach((at, index) => {
      const p = axis === 'x' ? { x: value, y: at } : { x: at, y: value };
      const voidHere = isVoid(p, axis);
      if (!voidHere && runStart === null) runStart = at;
      const last = index === samples.length - 1;
      if ((voidHere || last) && runStart !== null) {
        const end = voidHere ? at - step : hi;
        if (end - runStart >= MIN_SIDE) {
          out.push(axis === 'x' ? { x1: value, y1: runStart, x2: value, y2: end } : { x1: runStart, y1: value, x2: end, y2: value });
        }
        runStart = null;
      }
    });
  }
  return out;
}

// Dos aberturas del mismo muro a menos de esto (mm) son la misma.
const SAME_APERTURE_MM = 600;

/** Aberturas medidas + las del modelo que no duplican ninguna del mismo muro; ids únicos. */
function mergeApertures(measured: PlanAperture[], model: PlanAperture[], walls: PlanWall[]): PlanAperture[] {
  const lengthOf = new Map(walls.map((w) => [w.id, Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y)]));
  const out = [...measured];
  for (const a of model) {
    const len = lengthOf.get(a.wallId) ?? 0;
    const duplicate = out.some((b) => b.wallId === a.wallId && Math.abs(b.position - a.position) * len < SAME_APERTURE_MM);
    if (!duplicate) out.push(a);
  }
  return out.map((a, i) => ({ ...a, id: `a${i}` }));
}

/** Clases de grosor (mm) de las bandas medidas: tabique y fachada. */
function thicknessClasses(prepared: PreparedSketch, scale: Scale): { thin: number; thick: number } {
  const fallback = prepared.opts.wallThicknessMm;
  if (!prepared.fromPixels) return { thin: fallback, thick: fallback };
  const mmPerUnit = (scale.mmPerUnitX + scale.mmPerUnitY) / 2;
  const measuredMm = prepared.sourceWalls.map((w) => (w.thickness === undefined ? undefined : w.thickness * mmPerUnit));
  const classes = [...new Set(classifyWallThickness(measuredMm, fallback))];
  return { thin: Math.min(...classes), thick: Math.max(...classes) };
}

function pointInPolygon(p: SketchPoint, polygon: SketchPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ── Zonas ────────────────────────────────────────────────────────────────────

function buildZones(
  polys: Poly[],
  wallSegments: Segment[],
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  scale: Scale,
): PlanZone[] {
  const zones: PlanZone[] = polys.map((poly, i) => ({
    id: `z${i}`,
    name: poly.room.nombre,
    outline: (poly.room.exterior === true ? poly.body : insetPolygon(poly.body, wallSegments, scale)).map((p) =>
      toMm(p.x, p.y, scale),
    ),
    walls: [],
    apertures: [],
    dimensions: [],
  }));
  const zoneOfWall = new Map<string, PlanZone>();
  wallSegments.forEach((s, i) => {
    const owner = s.owners.find((o) => polys[o]!.room.exterior !== true) ?? s.owners[0]!;
    const zone = zones[owner]!;
    const wall = planWalls[i]!;
    zone.walls.push(wall);
    zoneOfWall.set(wall.id, zone);
  });
  for (const ap of apertures) zoneOfWall.get(ap.wallId)?.apertures.push(ap);
  return zones;
}

/**
 * Cara INTERIOR de la estancia: cada arista retrocede medio grosor del muro
 * que la forma, para que la medida de la zona sea la luz entre caras (lo que
 * expresan las cotas escritas). Las aristas consecutivas son perpendiculares.
 */
function insetPolygon(points: SketchPoint[], segments: Segment[], scale: Scale): SketchPoint[] {
  const n = points.length;
  const shifted = points.map((a, i) => {
    const b = points[(i + 1) % n]!;
    const axis: Axis = a.x === b.x ? 'x' : 'y';
    const value = axis === 'x' ? a.x : a.y;
    const lo = axis === 'x' ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
    const hi = axis === 'x' ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
    const thicknessMm = Math.max(
      0,
      ...segments
        .filter((s) => s.axis === axis && s.value === value && Math.min(s.hi, hi) - Math.max(s.lo, lo) > 0)
        .map((s) => s.thicknessMm),
    );
    const mmPerUnit = axis === 'x' ? scale.mmPerUnitX : scale.mmPerUnitY;
    const half = thicknessMm / 2 / mmPerUnit;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const probe = axis === 'x' ? { x: mid.x + PROBE, y: mid.y } : { x: mid.x, y: mid.y + PROBE };
    const inwardPositive = pointInPolygon(probe, points);
    return { axis, value: value + (inwardPositive ? half : -half) };
  });
  return points.map((_, i) => {
    const before = shifted[(i + n - 1) % n]!;
    const after = shifted[i]!;
    // El vértice i es el encuentro de la arista anterior (i-1→i) y la actual (i→i+1).
    const x = before.axis === 'x' ? before.value : after.value;
    const y = before.axis === 'y' ? before.value : after.value;
    return { x, y };
  });
}

function toMm(x: number, y: number, s: Scale): PlanPoint {
  return { x: Math.round(x * s.mmPerUnitX), y: Math.round(y * s.mmPerUnitY) };
}
