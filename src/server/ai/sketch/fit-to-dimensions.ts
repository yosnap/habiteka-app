/**
 * Ajuste DETERMINISTA del plano a las cotas escritas.
 *
 * Un plano ortogonal es, por eje, un conjunto de LÍNEAS de muro (las x de los
 * muros verticales, las y de los horizontales). Cada cota escrita de una
 * estancia ("3,00 x 4,00") fija la distancia entre las dos líneas que la
 * limitan; la cota general fija la distancia entre las líneas extremas. Se
 * resuelve por mínimos cuadrados con un anclaje débil a la posición original:
 * las líneas sin cota se quedan donde estaban, las compartidas entre dos
 * estancias reparten la corrección y una cota contradictoria no rompe nada
 * (queda residuo, que se reporta). Sin librerías: sistema normal pequeño
 * resuelto por eliminación gaussiana. Puro y sin IA.
 *
 * Identidad de línea por EXTENSIÓN: dos tramos colineales sólo son la misma
 * línea si se tocan o solapan a lo largo del eje perpendicular. El fondo de un
 * dormitorio y el tabique cocina/comedor al otro lado del plano pueden
 * compartir coordenada por casualidad sin ser el mismo muro; fusionarlos
 * encadenaba cotas incompatibles. Las cotas contradictorias (residuo grande
 * tras resolver) se retiran una a una, de mayor a menor, con aviso.
 */
import type {
  DimensionCorrection,
  PlanImportWarning,
  PlanPoint,
  PlanWall,
  PlanZone,
  Plano2dPayload,
} from '@/lib/contracts';

export interface RoomExpectation {
  zoneId: string;
  widthMm?: number;
  heightMm?: number;
}

export interface FitOptions {
  /** Solo para lecturas raster: acepta que una cifra incluya el espesor de pared. */
  inferRoomReference: boolean;
  /** Desviación relativa por debajo de la cual una cota se da por cumplida. */
  tolerance: number;
  /** Corrección relativa máxima creíble; por encima la cota se ignora con aviso. */
  maxRelativeCorrection: number;
  /**
   * Corrección relativa máxima de la cota GENERAL. Más estricta: la cota
   * general de un plano a menudo abarca terraza o entrada, fuera de la caja de
   * muros; si no cuadra con lo medido, no es la de esa caja y se descarta.
   */
  maxGeneralCorrection: number;
  /** Distancia (mm) para agrupar coordenadas en una misma línea de muro. */
  lineSnapMm: number;
  /** Peso del anclaje a la posición original frente a las cotas (0–1). */
  anchorWeight: number;
  /** Residuo relativo a partir del cual una cota se considera contradictoria y se retira. */
  rejectResidual: number;
  /**
   * Muros MEDIDOS (mm) que sólo sirven para decidir qué tramos colineales son
   * el mismo muro físico: la fachada medida de un extremo a otro une los
   * tramos de estancias que no se tocan (un retranqueo intermedio los separa).
   */
  lineHints?: PlanWall[];
}

export const DEFAULT_FIT_OPTIONS: FitOptions = {
  inferRoomReference: false,
  tolerance: 0.03,
  maxRelativeCorrection: 0.15,
  maxGeneralCorrection: 0.15,
  lineSnapMm: 60,
  anchorWeight: 0.0001,
  rejectResidual: 0.05,
};

export interface FitResult {
  plano: Plano2dPayload;
  corrections: DimensionCorrection[];
  warnings: PlanImportWarning[];
}

type Axis = 'x' | 'y';

// Dos tramos colineales a menos de esto (mm) en el eje perpendicular son la misma línea.
const EXTENT_JOIN_MM = 300;
// Un punto pertenece a una línea si cae dentro de su extensión con esta holgura (mm).
const EXTENT_TOLERANCE_MM = 300;
// Solape mínimo (fracción del lado de la estancia) para que una línea limite esa estancia.
const MIN_ROOM_OVERLAP = 0.3;
// La cota general pesa mucho menos que las de estancia: en un plano dibujado
// suele ser aproximada (8,50 exterior con estancias que suman 8,50 interior).
const GENERAL_WEIGHT = 0.2;
// Iteraciones de reponderación y peso mínimo de una cota contradictoria (nunca
// cero: la estancia no debe colapsar, sólo ceder ante sus vecinas).
const IRLS_ITERATIONS = 6;
const MIN_WEIGHT = 0.05;

/** Ajusta muros, contornos y cotas del plano a las medidas esperadas. */
export function fitPlanToDimensions(
  plano: Plano2dPayload,
  rooms: RoomExpectation[],
  general?: { widthMm?: number; heightMm?: number },
  options: Partial<FitOptions> = {},
): FitResult {
  const opts = { ...DEFAULT_FIT_OPTIONS, ...options };
  const walls = uniqueWalls(plano);
  const corrections: DimensionCorrection[] = [];
  const warnings: PlanImportWarning[] = [];
  const mappers: Record<Axis, (v: number, perp: number) => number> = { x: (v) => v, y: (v) => v };
  // Cada contorno de estancia viaja con SUS dos líneas (las que el solver
  // movió para cumplir su cota), no con la línea más cercana a cada esquina:
  // un lado de estancia puede rebasar la extensión de su muro medido.
  const zoneSides: Record<Axis, Map<string, { min: number; max: number }>> = { x: new Map(), y: new Map() };

  for (const axis of ['x', 'y'] as const) {
    const lines = wallLines(walls, axis, opts.lineSnapMm, opts.lineHints ?? []);
    if (lines.length < 2) continue;
    let constraints: Constraint[] = [];
    const zoneLines = new Map<string, { lo: number; hi: number }>();
    for (const zone of plano.zones) {
      if (zone.outline.length !== 4) continue;
      const bounds = outlineBounds(zone.outline, axis);
      const perp = outlineBounds(zone.outline, axis === 'x' ? 'y' : 'x');
      const lo = nearestLine(lines, bounds.min, 'below', opts.lineSnapMm * 6, perp);
      const hi = nearestLine(lines, bounds.max, 'above', opts.lineSnapMm * 6, perp);
      if (lo !== null && hi !== null && lo !== hi) zoneLines.set(zone.id, { lo, hi });
    }

    for (const room of rooms) {
      const expected = axis === 'x' ? room.widthMm : room.heightMm;
      if (expected === undefined) continue;
      const zone = plano.zones.find((z) => z.id === room.zoneId);
      if (!zone || zone.outline.length < 3) continue;
      const bounds = outlineBounds(zone.outline, axis);
      const found = zoneLines.get(zone.id);
      const lo = found?.lo ?? null;
      const hi = found?.hi ?? null;
      if (lo === null || hi === null || lo === hi) {
        warnings.push({
          code: 'cota-no-aplicable',
          zoneId: zone.id,
          message: `No se localizan los muros que limitan «${zone.name}» en el eje ${axis}.`,
        });
        continue;
      }
      const clearSpan = bounds.max - bounds.min;
      const axisGap = lines[hi]!.value - lines[lo]!.value;
      const outerSpan = axisGap + (lines[lo]!.thicknessMm + lines[hi]!.thicknessMm) / 2;
      // Una cifra junto a una estancia puede indicar luz libre, distancia
      // entre ejes o longitud exterior con ambos espesores incluidos. Si ya
      // coincide con un trazo medido, no se desplaza el muro para forzarla a
      // ser una medida interior.
      const nearby = (opts.inferRoomReference ? [clearSpan, axisGap, outerSpan] : [clearSpan])
        .filter((span) => Math.abs(span - expected) / expected <= opts.tolerance)
        .sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected));
      const measured = nearby[0] ?? clearSpan;
      const deviation = Math.abs(expected - measured) / expected;
      if (deviation > opts.maxRelativeCorrection) {
        warnings.push({
          code: 'cota-contradictoria',
          zoneId: zone.id,
          message: `«${zone.name}»: medida ${fmt(measured)} frente a cota ${fmt(expected)} (desvío ${Math.round(deviation * 100)} %); no se aplica.`,
        });
        continue;
      }
      // Se conserva la diferencia entre el tramo de referencia elegido y los
      // ejes. Las cotas ya cumplidas también anclan las líneas compartidas.
      constraints.push({
        lo, hi, distance: expected + (axisGap - measured), zoneId: zone.id, zoneName: zone.name,
        measured, expected, weight: 1, active: deviation > opts.tolerance,
      });
    }

    const generalExpected = axis === 'x' ? general?.widthMm : general?.heightMm;
    if (generalExpected !== undefined) {
      const first = extremeLine(lines, 'min');
      const last = extremeLine(lines, 'max');
      const outer = lines[last]!.value - lines[first]!.value;
      const outerThickness = (lines[first]!.thicknessMm + lines[last]!.thicknessMm) / 2;
      const desired = generalExpected - outerThickness;
      const deviation = Math.abs(desired - outer) / desired;
      if (deviation > opts.tolerance && deviation <= opts.maxGeneralCorrection) {
        constraints.push({
          lo: first, hi: last, distance: desired, zoneId: null, zoneName: null,
          measured: outer, expected: desired, weight: GENERAL_WEIGHT, active: true,
        });
      }
    }

    if (!constraints.some((c) => c.active)) continue;
    const original = lines.map((l) => l.value);
    // Mínimos cuadrados REPONDERADOS: una cota que tras resolver queda lejos
    // de cumplirse pierde peso en proporción a su residuo (tipo Huber). Así un
    // grupo de cotas incompatibles reparte el desajuste en vez de cargarlo
    // sobre una sola, y una cota aislada y absurda deja de deformar al resto.
    let solved = solveLines(original, constraints, opts.anchorWeight, extremeLine(lines, 'min'));
    for (let iteration = 0; iteration < IRLS_ITERATIONS; iteration++) {
      constraints = constraints.map((c) => {
        if (c.zoneId === null) return c;
        const residual = Math.abs(solved[c.hi]! - solved[c.lo]! - c.distance) / c.expected;
        const weight = Math.max(MIN_WEIGHT, Math.min(1, opts.rejectResidual / Math.max(residual, 1e-9)));
        return { ...c, weight };
      });
      solved = solveLines(original, constraints, opts.anchorWeight, extremeLine(lines, 'min'));
    }
    for (const c of constraints) {
      if (c.zoneId === null) continue;
      const residual = Math.abs(solved[c.hi]! - solved[c.lo]! - c.distance) / c.expected;
      if (residual <= opts.rejectResidual) continue;
      warnings.push({
        code: 'cota-contradictoria',
        zoneId: c.zoneId,
        message: `«${c.zoneName}»: la cota ${fmt(c.expected)} en el eje ${axis} no es compatible con las de las estancias vecinas; se aproxima sin cumplirla.`,
      });
    }

    mappers[axis] = buildMapper(lines, solved, opts.lineSnapMm * 4);
    for (const [zoneId, { lo, hi }] of zoneLines) {
      zoneSides[axis].set(zoneId, { min: solved[lo]! - original[lo]!, max: solved[hi]! - original[hi]! });
    }
    for (const c of constraints) {
      if (c.zoneId === null) continue;
      const newGap = solved[c.hi]! - solved[c.lo]!;
      const originalGap = original[c.hi]! - original[c.lo]!;
      const newMeasured = c.measured + (newGap - originalGap);
      if (!c.active && Math.abs(newMeasured - c.expected) / c.expected <= opts.tolerance) continue;
      corrections.push({
        zoneId: c.zoneId,
        axis,
        measuredMm: Math.round(c.measured),
        expectedMm: Math.round(c.expected),
        residualMm: Math.round(newMeasured - c.expected),
      });
    }
  }

  const mapPoint = (p: PlanPoint): PlanPoint => ({
    x: Math.round(mappers.x(p.x, p.y)),
    y: Math.round(mappers.y(p.y, p.x)),
  });
  const mapOutline = (zone: PlanZone): PlanPoint[] => {
    if (zone.outline.length !== 4) return zone.outline.map(mapPoint);
    // Un rectángulo sigue siendo rectángulo: cada lado se desplaza con su
    // línea (o, sin línea de zona, con el mapeo evaluado en el centro del lado).
    const sx = zoneSides.x.get(zone.id);
    const sy = zoneSides.y.get(zone.id);
    const bx = outlineBounds(zone.outline, 'x');
    const by = outlineBounds(zone.outline, 'y');
    const midX = (bx.min + bx.max) / 2;
    const midY = (by.min + by.max) / 2;
    const sideX = {
      min: sx ? bx.min + sx.min : mappers.x(bx.min, midY),
      max: sx ? bx.max + sx.max : mappers.x(bx.max, midY),
    };
    const sideY = {
      min: sy ? by.min + sy.min : mappers.y(by.min, midX),
      max: sy ? by.max + sy.max : mappers.y(by.max, midX),
    };
    return zone.outline.map((p) => ({
      x: Math.round(p.x - bx.min <= bx.max - p.x ? sideX.min : sideX.max),
      y: Math.round(p.y - by.min <= by.max - p.y ? sideY.min : sideY.max),
    }));
  };
  const zones: PlanZone[] = plano.zones.map((zone) => ({
    ...zone,
    outline: mapOutline(zone),
    walls: zone.walls.map((w) => ({ ...w, from: mapPoint(w.from), to: mapPoint(w.to) })),
    dimensions: zone.dimensions.map((d) => {
      const from = mapPoint(d.from);
      const to = mapPoint(d.to);
      return { ...d, from, to, label: `${(Math.hypot(to.x - from.x, to.y - from.y) / 1000).toFixed(2)} m` };
    }),
  }));
  return { plano: { ...plano, zones }, corrections, warnings };
}

// ── Líneas de muro por eje ───────────────────────────────────────────────────

interface WallLine {
  value: number;
  /** Extensión a lo largo del eje perpendicular (mm). */
  lo: number;
  hi: number;
  thicknessMm: number;
}

interface Constraint {
  lo: number;
  hi: number;
  distance: number;
  zoneId: string | null;
  zoneName: string | null;
  measured: number;
  expected: number;
  weight: number;
  /** False = cota ya cumplida que sólo actúa como ancla. */
  active: boolean;
}

function uniqueWalls(plano: Plano2dPayload): PlanWall[] {
  const seen = new Map<string, PlanWall>();
  for (const zone of plano.zones) for (const w of zone.walls) if (!seen.has(w.id)) seen.set(w.id, w);
  return [...seen.values()];
}

/**
 * Muros PERPENDICULARES al eje agrupados en líneas: misma coordenada (±snap)
 * y extensiones que se tocan o solapan. Orden por coordenada.
 */
export function wallLines(walls: PlanWall[], axis: Axis, snapMm: number, hints: PlanWall[]): WallLine[] {
  // Los muros medidos van primero: forman la línea con su extensión completa y
  // los tramos del plano se adhieren a ella; su grosor no cuenta.
  const candidates = [...hints.map((w) => ({ ...w, thicknessMm: 0 })), ...walls]
    .filter((w) => (axis === 'x' ? w.from.x === w.to.x : w.from.y === w.to.y))
    .map((w) => ({
      value: axis === 'x' ? w.from.x : w.from.y,
      lo: axis === 'x' ? Math.min(w.from.y, w.to.y) : Math.min(w.from.x, w.to.x),
      hi: axis === 'x' ? Math.max(w.from.y, w.to.y) : Math.max(w.from.x, w.to.x),
      thicknessMm: w.thicknessMm,
    }))
    .sort((a, b) => a.value - b.value);
  const lines: Array<WallLine & { count: number }> = [];
  for (const c of candidates) {
    let joined = false;
    for (const line of lines) {
      if (Math.abs(c.value - line.value) > snapMm) continue;
      if (Math.min(c.hi, line.hi) - Math.max(c.lo, line.lo) < -EXTENT_JOIN_MM) continue;
      line.value = (line.value * line.count + c.value) / (line.count + 1);
      line.lo = Math.min(line.lo, c.lo);
      line.hi = Math.max(line.hi, c.hi);
      line.thicknessMm = Math.max(line.thicknessMm, c.thicknessMm);
      line.count++;
      joined = true;
      break;
    }
    if (!joined) lines.push({ ...c, count: 1 });
  }
  return lines
    .sort((a, b) => a.value - b.value)
    .map(({ value, lo, hi, thicknessMm }) => ({ value, lo, hi, thicknessMm }));
}

function outlineBounds(outline: PlanPoint[], axis: Axis): { min: number; max: number } {
  const values = outline.map((p) => p[axis]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Índice de la línea de coordenada mínima (`min`) o máxima (`max`). */
function extremeLine(lines: WallLine[], which: 'min' | 'max'): number {
  let best = 0;
  lines.forEach((l, i) => {
    if (which === 'min' ? l.value < lines[best]!.value : l.value > lines[best]!.value) best = i;
  });
  return best;
}

/**
 * Línea más cercana a `value` por debajo (`below`) o por encima (`above`),
 * dentro de `maxDist`, cuya extensión solapa el lado perpendicular `perp` de
 * la estancia. Se admite un pequeño solape en sentido contrario (la cara
 * interior puede quedar un pelo dentro del eje).
 */
export function nearestLine(
  lines: WallLine[],
  value: number,
  side: 'below' | 'above',
  maxDist: number,
  perp: { min: number; max: number },
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  const minOverlap = (perp.max - perp.min) * MIN_ROOM_OVERLAP;
  lines.forEach((line, i) => {
    const d = side === 'below' ? value - line.value : line.value - value;
    if (d < -maxDist / 3 || d > maxDist) return;
    if (Math.min(perp.max, line.hi) - Math.max(perp.min, line.lo) < minOverlap) return;
    if (Math.abs(d) < bestDist) {
      best = i;
      bestDist = Math.abs(d);
    }
  });
  return best;
}

// ── Mínimos cuadrados ────────────────────────────────────────────────────────

/**
 * Minimiza  anchor·Σ(x_i − x0_i)² + Σ w_c·(x_hi − x_lo − d)²  resolviendo el
 * sistema normal (A·x = b). Simétrico definido positivo gracias al anclaje.
 * La línea `fixed` (la fachada de coordenada mínima) queda clavada: sin ella
 * el reparto desplazaría el plano entero (grado de libertad de traslación).
 */
function solveLines(original: number[], constraints: Constraint[], anchorWeight: number, fixed: number): number[] {
  const n = original.length;
  const a: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const b: number[] = Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const weight = i === fixed ? 1 : anchorWeight;
    a[i]![i] = weight;
    b[i] = weight * original[i]!;
  }
  for (const c of constraints) {
    const w = c.weight;
    const hiRow = a[c.hi]!;
    const loRow = a[c.lo]!;
    hiRow[c.hi] = hiRow[c.hi]! + w;
    loRow[c.lo] = loRow[c.lo]! + w;
    hiRow[c.lo] = hiRow[c.lo]! - w;
    loRow[c.hi] = loRow[c.hi]! - w;
    b[c.hi] = b[c.hi]! + w * c.distance;
    b[c.lo] = b[c.lo]! - w * c.distance;
  }
  return gaussianSolve(a, b) ?? original;
}

function gaussianSolve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]! / m[col]![col]!;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) m[r]![k]! -= factor * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/**
 * Desplazamiento de cualquier coordenada del eje dada su coordenada
 * perpendicular: las que caen sobre una línea o pegadas a ella (`rigidMm`: las
 * caras interiores del contorno, a medio grosor del eje) y dentro de su
 * extensión se mueven con la línea; las intermedias (extremos de muros
 * paralelos) se interpolan entre las líneas vecinas que abarcan ese punto
 * para que nada se deforme. Sin línea que abarque el punto, valen todas.
 */
function buildMapper(lines: WallLine[], solved: number[], rigidMm: number): (v: number, perp: number) => number {
  const deltas = solved.map((s, i) => s - lines[i]!.value);
  const covers = (line: WallLine, perp: number) =>
    perp >= line.lo - EXTENT_TOLERANCE_MM && perp <= line.hi + EXTENT_TOLERANCE_MM;

  return (v: number, perp: number) => {
    const covering = lines.map((l, i) => i).filter((i) => covers(lines[i]!, perp));
    const pool = covering.length > 0 ? covering : lines.map((_, i) => i);

    let nearest: number | null = null;
    for (const i of pool) {
      if (nearest === null || Math.abs(v - lines[i]!.value) < Math.abs(v - lines[nearest]!.value)) nearest = i;
    }
    if (nearest !== null && Math.abs(v - lines[nearest]!.value) <= rigidMm) return v + deltas[nearest]!;

    let below: number | null = null;
    let above: number | null = null;
    for (const i of pool) {
      const value = lines[i]!.value;
      if (value <= v && (below === null || value > lines[below]!.value)) below = i;
      if (value >= v && (above === null || value < lines[above]!.value)) above = i;
    }
    if (below === null && above === null) return v;
    if (below === null) return v + deltas[above!]!;
    if (above === null) return v + deltas[below]!;
    const span = lines[above]!.value - lines[below]!.value;
    const t = span === 0 ? 0 : (v - lines[below]!.value) / span;
    return v + deltas[below]! + (deltas[above]! - deltas[below]!) * t;
  };
}

function fmt(mm: number): string {
  return `${(mm / 1000).toFixed(2)} m`;
}
