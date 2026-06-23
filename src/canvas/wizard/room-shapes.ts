/**
 * Contorno de muros de una sala por FORMA (rectángulo, L, U, T). Lógica PURA y
 * testeable (sin React ni Konva): a partir de unos parámetros en metros produce el
 * polígono INTERIOR de la sala y, de él, los muros axis-aligned que lo rodean.
 *
 * Modelo: cada forma es un polígono ortogonal (todas las aristas horizontales o
 * verticales) cuyo INTERIOR son las medidas útiles pedidas. El recorrido de vértices
 * es horario en el sistema de Konva (origen arriba-izquierda, Y hacia ABAJO), de modo
 * que la normal exterior de cada arista apunta "hacia afuera" del interior. Cada arista
 * del perímetro se convierte en un muro (caja fina de grosor `t`) colocado por FUERA del
 * interior; las esquinas se cierran extendiendo medio grosor en cada extremo.
 *
 * Reusa `metersToPx` (escala) y el grosor de muro por defecto; no duplica la conversión.
 */
import type { StructObj } from '../types';
import { metersToPx } from '../scale';
import { DEFAULT_WALL_THICKNESS_M } from '../draw-wall';

/** Formas de sala soportadas por el wizard. */
export type RoomShape = 'rect' | 'l' | 'u' | 't';

/** Punto en píxeles de plano (sistema Konva: Y hacia abajo). */
export interface Pt {
  x: number;
  y: number;
}

/** Parámetros de una sala rectangular: interior `widthM × lengthM`. */
export interface RectParams {
  shape: 'rect';
  widthM: number;
  lengthM: number;
}

/**
 * Sala en L: rectángulo `widthM × lengthM` al que se le RECORTA una esquina
 * (la inferior-derecha) de tamaño `cutWidthM × cutLengthM`. El recorte debe ser
 * menor que el total en ambos ejes.
 */
export interface LParams {
  shape: 'l';
  widthM: number;
  lengthM: number;
  /** Ancho del recorte (sobre el eje X), < widthM. */
  cutWidthM: number;
  /** Largo del recorte (sobre el eje Y), < lengthM. */
  cutLengthM: number;
}

/**
 * Sala en U: rectángulo `widthM × lengthM` con una entrante central abierta por
 * el lado inferior, de ancho `notchWidthM` y profundidad `notchLengthM`. Deja dos
 * brazos laterales. La entrante debe ser más estrecha y menos profunda que el total.
 */
export interface UParams {
  shape: 'u';
  widthM: number;
  lengthM: number;
  /** Ancho de la entrante central (sobre X), < widthM. */
  notchWidthM: number;
  /** Profundidad de la entrante (sobre Y), < lengthM. */
  notchLengthM: number;
}

/**
 * Sala en T: barra horizontal superior de `widthM × barLengthM` y un vástago
 * central que cuelga hacia abajo, de ancho `stemWidthM` y largo `stemLengthM`.
 * El vástago es más estrecho que la barra y se centra en X.
 */
export interface TParams {
  shape: 't';
  /** Ancho total de la barra superior (X). */
  widthM: number;
  /** Largo total de la sala (Y) = barra + vástago. */
  lengthM: number;
  /** Largo de la barra superior (Y), < lengthM. */
  barLengthM: number;
  /** Ancho del vástago (X), < widthM. */
  stemWidthM: number;
}

export type RoomShapeParams = RectParams | LParams | UParams | TParams;

/** Píxeles por metro por defecto (1:100), alineado con `build-room-doc`. */
const DEFAULT_PX_PER_METER = 100;

/** ¿`v` es un número real y positivo? */
function pos(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/**
 * ¿Los parámetros describen una forma VÁLIDA (medidas positivas y recortes que caben
 * dentro del total)? Pura: el wizard la usa para habilitar/deshabilitar el "crear".
 */
export function isValidShape(p: RoomShapeParams): boolean {
  switch (p.shape) {
    case 'rect':
      return pos(p.widthM) && pos(p.lengthM);
    case 'l':
      return (
        pos(p.widthM) &&
        pos(p.lengthM) &&
        pos(p.cutWidthM) &&
        pos(p.cutLengthM) &&
        p.cutWidthM < p.widthM &&
        p.cutLengthM < p.lengthM
      );
    case 'u':
      return (
        pos(p.widthM) &&
        pos(p.lengthM) &&
        pos(p.notchWidthM) &&
        pos(p.notchLengthM) &&
        p.notchWidthM < p.widthM &&
        p.notchLengthM < p.lengthM
      );
    case 't':
      return (
        pos(p.widthM) &&
        pos(p.lengthM) &&
        pos(p.barLengthM) &&
        pos(p.stemWidthM) &&
        p.barLengthM < p.lengthM &&
        p.stemWidthM < p.widthM
      );
  }
}

/**
 * Vértices del polígono INTERIOR de la sala en píxeles, con origen en (0,0) (esquina
 * sup-izq del bounding box) y recorrido HORARIO en el sistema Konva (Y hacia abajo).
 * El caller traslada estos vértices al origen del lienzo. Devuelve `[]` si la forma
 * no es válida.
 */
export function roomOutline(
  params: RoomShapeParams,
  pxPerMeter: number = DEFAULT_PX_PER_METER,
): Pt[] {
  if (!isValidShape(params)) return [];
  const scale = { pxPerMeter };
  const m = (v: number) => metersToPx(v, scale);

  switch (params.shape) {
    case 'rect': {
      const w = m(params.widthM);
      const l = m(params.lengthM);
      // Horario desde la esquina sup-izq.
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: l },
        { x: 0, y: l },
      ];
    }
    case 'l': {
      const w = m(params.widthM);
      const l = m(params.lengthM);
      const cw = m(params.cutWidthM);
      const cl = m(params.cutLengthM);
      // Recorte en la esquina inferior-derecha. Horario:
      // sup-izq → sup-der → baja hasta inicio del recorte → izquierda (entra el recorte)
      // → baja hasta el fondo → inf-izq.
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: l - cl },
        { x: w - cw, y: l - cl },
        { x: w - cw, y: l },
        { x: 0, y: l },
      ];
    }
    case 'u': {
      const w = m(params.widthM);
      const l = m(params.lengthM);
      const nw = m(params.notchWidthM);
      const nl = m(params.notchLengthM);
      // Entrante central abierta por abajo. La entrante ocupa [x1, x2] en X y
      // sube `nl` desde el borde inferior. Centrada en X.
      const x1 = (w - nw) / 2;
      const x2 = x1 + nw;
      // Horario: contorno exterior bajando por la derecha hasta abajo, entra por la
      // base derecha del brazo derecho, sube por la entrante, baja por la base
      // izquierda del brazo izquierdo, cierra por la izquierda.
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: l },
        { x: x2, y: l },
        { x: x2, y: l - nl },
        { x: x1, y: l - nl },
        { x: x1, y: l },
        { x: 0, y: l },
      ];
    }
    case 't': {
      const w = m(params.widthM);
      const l = m(params.lengthM);
      const bl = m(params.barLengthM);
      const sw = m(params.stemWidthM);
      // Barra superior de ancho `w` y alto `bl`; vástago de ancho `sw` centrado en X,
      // colgando desde `bl` hasta `l`.
      const x1 = (w - sw) / 2;
      const x2 = x1 + sw;
      // Horario desde sup-izq: barra completa, baja por la derecha hasta el escalón,
      // entra a la derecha del vástago, baja el vástago, vuelve por su base, sube por
      // la izquierda del vástago, sale al escalón izquierdo, cierra por la izquierda.
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: bl },
        { x: x2, y: bl },
        { x: x2, y: l },
        { x: x1, y: l },
        { x: x1, y: bl },
        { x: 0, y: bl },
      ];
    }
  }
}

/**
 * Normal exterior unitaria de una arista de un polígono recorrido en HORARIO en el
 * sistema Konva (origen arriba-izquierda, Y hacia ABAJO). En ese sistema un recorrido
 * horario deja el interior a la DERECHA del avance, así que la normal exterior es la
 * dirección de avance girada 90° hacia la izquierda: `(dy, −dx)` normalizado. P. ej. la
 * arista superior va `+X` y su normal exterior sale hacia `−Y` (arriba). Las aristas son
 * axis-aligned, así que la normal cae exactamente sobre un eje (±X o ±Y).
 */
function outwardNormal(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}

/**
 * Convierte el contorno interior (vértices horarios, axis-aligned) en los muros que lo
 * rodean: un muro por arista, de grosor `t`, colocado por FUERA del interior y extendido
 * medio grosor en cada extremo para CERRAR las esquinas sin huecos. Cada muro es una caja
 * axis-aligned (`rotation:0`); las formas L/U/T no requieren muros rotados.
 *
 * El muro se devuelve como `StructObj{kind:'wall'}` con `x,y` en la esquina sup-izq de su
 * caja. Para una arista horizontal el muro tiene alto `t`; para una vertical, ancho `t`.
 */
export function outlineToWalls(vertices: Pt[], t: number, idPrefix = 'wall'): StructObj[] {
  const n = vertices.length;
  if (n < 4) return [];
  const walls: StructObj[] = [];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (!a || !b) continue; // inalcanzable (i < n); guarda para el indexado estricto
    const nrm = outwardNormal(a, b);
    const horizontal = Math.abs(a.y - b.y) < 1e-6; // arista horizontal (varía X)

    // Convención de cierre de esquinas (la misma del rect original): las aristas
    // HORIZONTALES (top/bottom) abarcan también las esquinas, extendiéndose un grosor
    // completo `t` en CADA extremo; las VERTICALES (left/right) no se extienden y quedan
    // entre las horizontales. Así dos muros adyacentes se solapan exactamente en el
    // cuadrado de esquina, sin huecos ni dobles conteos.
    if (horizontal) {
      const x0 = Math.min(a.x, b.x) - t;
      const len = Math.abs(b.x - a.x) + 2 * t;
      // La normal en Y indica el lado: +Y abajo, −Y arriba. El muro arranca en el
      // borde de la arista y se extiende `t` en el sentido de la normal.
      const yEdge = a.y;
      const y0 = nrm.y > 0 ? yEdge : yEdge - t;
      walls.push({
        id: `${idPrefix}-${i}`,
        kind: 'wall',
        x: x0,
        y: y0,
        width: len,
        height: t,
        rotation: 0,
      });
    } else {
      const y0 = Math.min(a.y, b.y);
      const len = Math.abs(b.y - a.y); // las verticales NO se extienden (las cierran las horizontales)
      const xEdge = a.x;
      const x0 = nrm.x > 0 ? xEdge : xEdge - t;
      walls.push({
        id: `${idPrefix}-${i}`,
        kind: 'wall',
        x: x0,
        y: y0,
        width: t,
        height: len,
        rotation: 0,
      });
    }
  }
  return walls;
}

/**
 * Contorno completo de una forma en píxeles de plano, ya trasladado al origen dado:
 * devuelve los vértices interiores (para el suelo poligonal y el preview) y los muros.
 * `t` es el grosor de muro en px (por defecto el del proyecto a la escala dada).
 */
export function buildShapeOutline(
  params: RoomShapeParams,
  origin: Pt,
  pxPerMeter: number = DEFAULT_PX_PER_METER,
  wallThicknessM: number = DEFAULT_WALL_THICKNESS_M,
): { vertices: Pt[]; walls: StructObj[] } {
  const local = roomOutline(params, pxPerMeter);
  if (local.length === 0) return { vertices: [], walls: [] };
  const vertices = local.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
  const t = metersToPx(wallThicknessM, { pxPerMeter });
  const walls = outlineToWalls(vertices, t);
  return { vertices, walls };
}
