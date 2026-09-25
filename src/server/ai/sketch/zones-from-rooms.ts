/**
 * Zonificación "primero las estancias" para PLANOS DIBUJADOS.
 *
 * En un plano limpio el modelo de visión sitúa bien cada estancia (caja +
 * nombre + medidas escritas), mientras que el relleno entre muros medidos
 * falla en cuanto un tabique fino no llega al raster: fusiona dos estancias o
 * trocea una en franjas. Aquí cada caja de estancia se ANCLA a las líneas de
 * muro medidas (precisión de píxel) y, cuando a un lado no le corresponde
 * ningún muro, se crea el tabique que falta.
 *
 * Anclaje GLOBAL guiado por cotas: la caja del modelo es aproximada (±3 % de
 * la imagen, más en estancias en L) y a cada lado le suelen caber varias
 * líneas medidas; elegir la más cercana lado a lado encadenaba estancias a
 * líneas equivocadas. Ahora cada estancia elige el PAR de líneas (o lado sin
 * línea) que mejor casa a la vez con la posición leída y con la medida
 * escrita, de modo que dos estancias que comparten un tabique acaban sobre
 * la misma línea y el solver de cotas trabaja sobre restricciones correctas.
 * Las estancias exteriores no generan muros: sus lados libres serán límites
 * ocultos. Puro y sin IA.
 */
import type { SketchRoom, SketchWall } from './sketch-types';

export interface RoomBox {
  name: string;
  exterior: boolean;
  /** Caja anclada, en unidades de imagen. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Medidas escritas (m) que acompañan a la estancia. */
  widthM?: number;
  heightM?: number;
  areaM2?: number;
}

export interface RoomZoning {
  rooms: RoomBox[];
  /** Tabiques que faltaban en la medición (lados de estancia sin muro). */
  addedWalls: SketchWall[];
}

/** Escala y grosor que permiten contrastar la caja con la medida escrita. */
export interface RoomAnchorGuide {
  /** Milímetros por unidad de imagen en cada eje. */
  mmPerUnitX: number;
  mmPerUnitY: number;
  /** Grosor típico de tabique en unidades de imagen; las líneas detectadas son ejes. */
  thicknessUnit: number;
}

// Un lado de estancia y una línea de muro coinciden si su recorrido solapa al
// menos esta fracción del lado.
const MIN_OVERLAP = 0.3;
// Lado mínimo de una estancia creíble (unidades de imagen).
const MIN_SIDE = 0.02;
// Ventana de búsqueda de líneas alrededor de cada lado leído, en múltiplos del snap.
const WINDOW_SNAPS = 2;
// Peso del error de MEDIDA frente al error de posición: la cota escrita es
// exacta, la caja del modelo no.
const DIMENSION_WEIGHT = 1.5;
// Coste (unidades de imagen) de dejar un lado sin línea medida: sólo compensa
// cuando ninguna línea casa con posición y medida a la vez.
const NO_LINE_PENALTY_SNAPS = 1.2;

interface Line {
  value: number;
  lo: number;
  hi: number;
}

/** Ancla las cajas de estancia a los muros medidos y detecta tabiques ausentes. */
export function zonesFromRooms(
  roomsIn: SketchRoom[],
  walls: SketchWall[],
  snap: number,
  guide?: RoomAnchorGuide,
): RoomZoning {
  const vertical = lines(walls, 'v');
  const horizontal = lines(walls, 'h');
  const rooms: RoomBox[] = [];
  const addedWalls: SketchWall[] = [];

  for (const room of roomsIn) {
    if (room.poligono.length < 3) continue;
    const xs = room.poligono.map((p) => p.x);
    const ys = room.poligono.map((p) => p.y);
    const raw = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    if (raw.maxX - raw.minX < MIN_SIDE || raw.maxY - raw.minY < MIN_SIDE) continue;

    const x = anchorSpan(vertical, raw.minX, raw.maxX, raw.minY, raw.maxY, snap, expectedSpan(room.anchoMetros, guide, 'x'));
    const y = anchorSpan(horizontal, raw.minY, raw.maxY, raw.minX, raw.maxX, snap, expectedSpan(room.altoMetros, guide, 'y'));
    const box = { minX: x.lo, maxX: x.hi, minY: y.lo, maxY: y.hi };
    if (box.maxX - box.minX < MIN_SIDE || box.maxY - box.minY < MIN_SIDE) continue;

    const exterior = room.exterior === true;
    rooms.push({
      name: room.nombre,
      exterior,
      ...box,
      ...(room.anchoMetros !== undefined ? { widthM: room.anchoMetros } : {}),
      ...(room.altoMetros !== undefined ? { heightM: room.altoMetros } : {}),
      ...(room.areaM2 !== undefined ? { areaM2: room.areaM2 } : {}),
    });
    if (exterior) continue;
    // Lado sin muro medido: el tabique existe en el plano pero no en el raster.
    if (!x.loSnapped) addedWalls.push({ x1: box.minX, y1: box.minY, x2: box.minX, y2: box.maxY });
    if (!x.hiSnapped) addedWalls.push({ x1: box.maxX, y1: box.minY, x2: box.maxX, y2: box.maxY });
    if (!y.loSnapped) addedWalls.push({ x1: box.minX, y1: box.minY, x2: box.maxX, y2: box.minY });
    if (!y.hiSnapped) addedWalls.push({ x1: box.minX, y1: box.maxY, x2: box.maxX, y2: box.maxY });
  }

  return { rooms, addedWalls: dedupe(addedWalls, snap) };
}

/** Posibles distancias entre ejes para cotas entre caras, ejes o extremos exteriores. */
function expectedSpan(meters: number | undefined, guide: RoomAnchorGuide | undefined, axis: 'x' | 'y'): number[] | undefined {
  if (meters === undefined || !guide) return undefined;
  const mmPerUnit = axis === 'x' ? guide.mmPerUnitX : guide.mmPerUnitY;
  if (!(mmPerUnit > 0)) return undefined;
  const span = (meters * 1000) / mmPerUnit;
  return [span + guide.thicknessUnit, span, span - guide.thicknessUnit].filter((value) => value > 0);
}

function lines(walls: SketchWall[], orientation: 'v' | 'h'): Line[] {
  return walls
    .filter((w) => (orientation === 'v' ? Math.abs(w.x1 - w.x2) < 1e-6 : Math.abs(w.y1 - w.y2) < 1e-6))
    .map((w) =>
      orientation === 'v'
        ? { value: w.x1, lo: Math.min(w.y1, w.y2), hi: Math.max(w.y1, w.y2) }
        : { value: w.y1, lo: Math.min(w.x1, w.x2), hi: Math.max(w.x1, w.x2) },
    );
}

interface AnchoredSpan {
  lo: number;
  hi: number;
  loSnapped: boolean;
  hiSnapped: boolean;
}

/**
 * Elige para un lado bajo/alto de la estancia el par (línea o lado leído) de
 * coste mínimo: error de posición de cada lado + error de la distancia entre
 * ambos respecto a la medida escrita (si la hay). Sólo se consideran líneas
 * cuyo recorrido solapa el lado perpendicular de la estancia.
 */
function anchorSpan(
  candidates: Line[],
  rawLo: number,
  rawHi: number,
  perpLo: number,
  perpHi: number,
  snap: number,
  expected: number[] | undefined,
): AnchoredSpan {
  const window = snap * WINDOW_SNAPS;
  const noLine = snap * NO_LINE_PENALTY_SNAPS;
  const near = (value: number): Array<number | null> => [
    null,
    ...candidates
      .filter((line) => Math.abs(line.value - value) <= window)
      .filter((line) => Math.min(perpHi, line.hi) - Math.max(perpLo, line.lo) >= (perpHi - perpLo) * MIN_OVERLAP)
      .map((line) => line.value),
  ];
  let best: AnchoredSpan = { lo: rawLo, hi: rawHi, loSnapped: false, hiSnapped: false };
  let bestCost = Infinity;
  for (const lo of near(rawLo)) {
    for (const hi of near(rawHi)) {
      const loValue = lo ?? rawLo;
      const hiValue = hi ?? rawHi;
      if (hiValue - loValue < MIN_SIDE) continue;
      let cost = (lo === null ? noLine : Math.abs(lo - rawLo)) + (hi === null ? noLine : Math.abs(hi - rawHi));
      if (expected !== undefined) cost += DIMENSION_WEIGHT * Math.min(
        ...expected.map((span) => Math.abs(hiValue - loValue - span)),
      );
      if (cost < bestCost) {
        bestCost = cost;
        best = { lo: loValue, hi: hiValue, loSnapped: lo !== null, hiSnapped: hi !== null };
      }
    }
  }
  return best;
}

/** Dos estancias contiguas sin muro medido proponen el mismo tabique: uno solo. */
function dedupe(walls: SketchWall[], snap: number): SketchWall[] {
  const out: SketchWall[] = [];
  for (const w of walls) {
    const vertical = Math.abs(w.x1 - w.x2) < 1e-6;
    const duplicate = out.some((o) => {
      const sameOrientation = Math.abs(o.x1 - o.x2) < 1e-6 === vertical;
      if (!sameOrientation) return false;
      const axisDist = vertical ? Math.abs(o.x1 - w.x1) : Math.abs(o.y1 - w.y1);
      if (axisDist > snap) return false;
      const [lo, hi] = vertical ? [Math.min(w.y1, w.y2), Math.max(w.y1, w.y2)] : [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)];
      const [olo, ohi] = vertical ? [Math.min(o.y1, o.y2), Math.max(o.y1, o.y2)] : [Math.min(o.x1, o.x2), Math.max(o.x1, o.x2)];
      return Math.min(hi, ohi) - Math.max(lo, olo) > (hi - lo) * 0.5;
    });
    if (!duplicate) out.push(w);
  }
  return out;
}
