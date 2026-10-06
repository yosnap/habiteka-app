import type { EditorDocument, Opening, Point } from './schema';
import { openingConstruction } from './construction-properties';
import { openFraction, openingType, type OpeningType } from './opening-types';
import { wallPath } from './wall-path';

/** Hoja o panel en coordenadas locales de la abertura: x a lo largo del muro, y hacia su normal izquierda (-dy, dx). */
export interface LeafPanel {
  center: Point;
  /** Eje largo de la hoja respecto al muro, en radianes. */
  angle: number;
  lengthMm: number;
  thicknessMm: number;
  glazed: boolean;
  /**
   * Solo las abatibles: giran sobre `pivot` desde `closedAngle` hasta `closedAngle + delta`. En una pivotante el eje
   * queda a `offsetMm` del canto (parte de la hoja barre la otra cara); una de vaivén abre hacia las dos caras.
   */
  hinge?: { pivot: Point; closedAngle: number; delta: number; offsetMm?: number; doubleActing?: boolean };
  /** Tramo vertical de la hoja como fracción de su alto (hojas de guillotina, parte que queda bajada de una seccional). */
  heightRange?: [number, number];
  /** Hoja fija junto a la principal (hoja y media): no gira ni se desliza. */
  fixed?: boolean;
  /** Extremo de la hoja con tirador a lo largo de su eje (+1, el canto libre); sin él, la hoja no lleva tirador. */
  pull?: 1 | -1;
  /** Cara de la hoja hacia la que abre (o la que da a la estancia en una corredera vista), sobre su normal izquierda. */
  face?: 1 | -1;
}

export interface LeafLayout {
  type: OpeningType;
  panels: LeafPanel[];
  /** Franjas fuera del muro que la hoja recorre al abrir (corredera vista, plegable): deben quedar libres. */
  travel: Point[][];
  /** Guía superior de la corredera vista, a lo largo de todo su recorrido. */
  rail?: { from: Point; to: Point };
  /** Seccional: huella en planta de los paneles recogidos bajo el techo, por encima de la abertura. */
  overhead?: Point[];
  /** Seccional: fracción de la puerta ya recogida (0 cerrada, 1 abierta). */
  lift?: number;
}

const SLIDING_GAP_MM = 10;
/** La hoja vista solapa cada jamba para tapar el hueco. */
const SLIDING_OVERLAP_MM = 40;
/** Cruce de las dos hojas de una corredera en marco. */
const MEETING_OVERLAP_MM = 50;
/** Una empotrada abierta deja ver su canto para tirar de ella. */
const POCKET_PULL_MM = 60;
/** Pliegue del acordeón abierto: los paneles no llegan a quedar perpendiculares. */
const FOLD_MAX_RAD = 60 * Math.PI / 180;
/** La corredera de granero cuelga de ruedas separadas de la pared por sus pletinas. */
const BARN_STANDOFF_MM = 20;
/** Las guías horizontales de la seccional pasan algo más allá del alto de la puerta para la curva. */
const GARAGE_TRACK_EXTRA_MM = 300;
/** Fondo del cajón donde se enrolla la persiana de una puerta enrollable. */
export const ROLLER_BOX_MM = 300;
/** Solape de las dos hojas de guillotina en el travesaño de encuentro, como fracción del alto. */
const SASH_LAP = .03;

const box = (x1: number, x2: number, y1: number, y2: number): Point[] => {
  const [left, right] = [Math.min(x1, x2), Math.max(x1, x2)], [low, high] = [Math.min(y1, y2), Math.max(y1, y2)];
  return [{ x: left, y: low }, { x: right, y: low }, { x: right, y: high }, { x: left, y: high }];
};

/**
 * Hojas de una puerta o ventana entre sus jambas, separadas `spanMm`. El 3D pasa la luz libre del marco y el plano 2D
 * el ancho completo, como hacía su símbolo histórico. Una hoja abatible de bisagra izquierda conserva exactamente las
 * cuentas del modelo de siempre para que los documentos antiguos no cambien.
 */
export function openingLeafLayout(opening: Opening, spanMm: number, wallThicknessMm: number): LeafLayout | null {
  const type = openingType(opening);
  if (!type) return null;
  const props = openingConstruction(opening);
  const side = props.swing === 'left' ? 1 : -1, hingeSide = props.hinge === 'left' ? -1 : 1, sign: 1 | -1 = side;
  const thickness = type.leafThicknessMm, fraction = openFraction(props.openAngleDeg);
  const flat = (x: number, y: number, lengthMm: number): LeafPanel =>
    ({ center: { x, y }, angle: 0, lengthMm, thicknessMm: thickness, glazed: type.glazed });
  switch (type.operation) {
    case 'abatible': {
      const leaf = (sideOfHinge: number, lengthMm: number, pivotX = sideOfHinge * spanMm / 2, offsetMm = 0): LeafPanel => {
        const theta = (props.swing === 'left' ? 1 : -1) * props.openAngleDeg * Math.PI / 180;
        const closedAngle = sideOfHinge < 0 ? 0 : Math.PI, delta = sideOfHinge < 0 ? theta : -theta;
        const angle = closedAngle + delta, pivot = { x: pivotX, y: 0 };
        // Sin desplazamiento del eje se conservan exactamente las cuentas del modelo histórico.
        const reach = (k: number) => offsetMm ? k * (lengthMm / 2 - offsetMm) : k * lengthMm / 2;
        return { center: { x: pivot.x + reach(Math.cos(angle)), y: reach(Math.sin(angle)) }, angle, pull: 1, face: (closedAngle === 0 ? sign : -sign) as 1 | -1,
          lengthMm, thicknessMm: thickness, glazed: type.glazed, hinge: { pivot, closedAngle, delta,
            ...(offsetMm ? { offsetMm } : {}), ...(type.doubleActing ? { doubleActing: true } : {}) } };
      };
      if (type.pivotRatio) {
        const offsetMm = spanMm * type.pivotRatio;
        return { type, travel: [], panels: [leaf(hingeSide, spanMm, hingeSide * (spanMm / 2 - offsetMm), offsetMm)] };
      }
      if (type.mainLeafRatio) {
        // Hoja y media: la principal gira en el lado de la bisagra; la estrecha queda fija junto a la otra jamba.
        const main = spanMm * type.mainLeafRatio, rest = spanMm - main;
        return { type, travel: [], panels: [leaf(hingeSide, main),
          { ...flat(-hingeSide * (spanMm - rest) / 2, 0, rest), fixed: true, face: sign }] };
      }
      if (type.leaves >= 3) {
        // Tres hojas: las de los extremos giran en sus jambas y la central en el montante que la separa de la primera.
        const third = spanMm / 3;
        return { type, travel: [], panels: [leaf(-1, third), leaf(-1, third, -spanMm / 6), leaf(1, third)] };
      }
      return { type, travel: [], panels: type.leaves >= 2 ? [leaf(-1, spanMm / 2), leaf(1, spanMm / 2)] : [leaf(hingeSide, spanMm)] };
    }
    case 'corredera': {
      // La hoja cuelga por la cara de apertura y se recoge hacia el lado de la «bisagra».
      const gap = SLIDING_GAP_MM + (type.barn ? BARN_STANDOFF_MM : 0), face = side * wallThicknessMm / 2;
      const y = side * (wallThicknessMm / 2 + gap + thickness / 2);
      if (type.leaves >= 2) {
        // Dos hojas que se encuentran en el centro y se recogen cada una hacia su lado.
        const lengthMm = spanMm / 2 + SLIDING_OVERLAP_MM, reach = spanMm + SLIDING_OVERLAP_MM;
        const closed = lengthMm / 2, shift = fraction * spanMm / 2;
        return { type, panels: [{ ...flat(-closed - shift, y, lengthMm), pull: 1, face: sign }, { ...flat(closed + shift, y, lengthMm), pull: -1, face: sign }],
          travel: [box(-reach, reach, face, face + side * (gap + thickness))], rail: { from: { x: -reach, y }, to: { x: reach, y } } };
      }
      const lengthMm = spanMm + 2 * SLIDING_OVERLAP_MM, parked = hingeSide * spanMm;
      const from = Math.min(0, parked) - lengthMm / 2, to = Math.max(0, parked) + lengthMm / 2;
      return { type, panels: [{ ...flat(parked * fraction, y, lengthMm), pull: hingeSide > 0 ? -1 : 1, face: sign }],
        travel: [box(from, to, face, face + side * (gap + thickness))], rail: { from: { x: from, y }, to: { x: to, y } } };
    }
    case 'corredera-empotrada':
      return { type, travel: [], panels: [{ ...flat(hingeSide * fraction * Math.max(0, spanMm - POCKET_PULL_MM), 0, spanMm),
        pull: hingeSide > 0 ? -1 : 1, face: sign }] };
    case 'corredera-marco': {
      if (type.leaves >= 4) {
        // Cuatro hojas: las de los extremos fijas en el carril de atrás; las centrales se abren por delante hacia ellas.
        const lengthMm = spanMm / 4 + MEETING_OVERLAP_MM / 2, offset = thickness / 2 + 5, fixedX = spanMm / 2 - lengthMm / 2;
        const slideX = lengthMm / 2 + fraction * (fixedX - lengthMm / 2);
        return { type, travel: [], panels: [flat(-fixedX, -side * offset, lengthMm), flat(-slideX, side * offset, lengthMm),
          flat(slideX, side * offset, lengthMm), flat(fixedX, -side * offset, lengthMm)] };
      }
      // La hoja del lado de la «bisagra» es fija; la otra se desliza por delante hasta cubrirla.
      const lengthMm = spanMm / 2 + MEETING_OVERLAP_MM / 2, offset = thickness / 2 + 5, end = spanMm / 2 - lengthMm / 2;
      return { type, travel: [], panels: [flat(hingeSide * end, -side * offset, lengthMm),
        flat(-hingeSide * end + hingeSide * fraction * (spanMm - lengthMm), side * offset, lengthMm)] };
    }
    case 'plegable': {
      // Acordeón: los paneles se pliegan en zigzag hacia la cara de apertura y se recogen junto a la jamba.
      const count = Math.max(2, type.leaves), panel = spanMm / count, fold = FOLD_MAX_RAD * fraction;
      let point: Point = { x: hingeSide * spanMm / 2, y: 0 };
      const panels = Array.from({ length: count }, (_, index) => {
        const next = { x: point.x - hingeSide * Math.cos(fold) * panel, y: point.y + (index % 2 ? -1 : 1) * side * Math.sin(fold) * panel };
        const leaf: LeafPanel = { center: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
          angle: Math.atan2(next.y - point.y, next.x - point.x), lengthMm: panel, thicknessMm: thickness, glazed: type.glazed };
        point = next;
        return index === count - 1 ? { ...leaf, pull: 1 as const, face: sign } : leaf;
      });
      return { type, panels, travel: [box(-spanMm / 2, spanMm / 2, 0, side * (Math.sin(FOLD_MAX_RAD) * panel + thickness / 2))] };
    }
    case 'seccional': case 'enrollable': case 'basculante': {
      // Se montan por la cara de apertura solapando las jambas y suben al abrir: la seccional se recoge bajo el techo,
      // la enrollable en su cajón sobre el hueco y la basculante queda horizontal, un tercio por fuera del muro.
      const lengthMm = spanMm + 2 * SLIDING_OVERLAP_MM, face = side * wallThicknessMm / 2, half = lengthMm / 2;
      const y = side * (wallThicknessMm / 2 + SLIDING_GAP_MM + thickness / 2);
      const panels: LeafPanel[] = [{ ...flat(0, y, lengthMm), heightRange: [fraction, 1], face: sign }];
      if (type.operation === 'enrollable')
        return { type, travel: [], lift: fraction, overhead: box(-half, half, face, face + side * ROLLER_BOX_MM), panels };
      if (type.operation === 'basculante') {
        const outside = props.heightMm / 3;
        return { type, lift: fraction, panels, travel: [box(-half, half, -face, -face - side * outside)],
          overhead: box(-half, half, -face - side * outside, face + side * (props.heightMm - outside + SLIDING_GAP_MM)) };
      }
      return { type, travel: [], lift: fraction, panels,
        overhead: box(-half, half, face, face + side * (props.heightMm + GARAGE_TRACK_EXTRA_MM)) };
    }
    case 'guillotina': {
      // Dos hojas a todo el ancho en carriles distintos: la inferior, por dentro, sube por delante de la superior.
      const offset = thickness / 2 + 5;
      return { type, travel: [], panels: [{ ...flat(0, side * offset, spanMm), heightRange: [0, .5 + SASH_LAP] },
        { ...flat(0, -side * offset, spanMm), heightRange: [.5 - SASH_LAP, 1] }] };
    }
    default:
      return { type, panels: [], travel: [] };
  }
}

/** Marco de la abertura en planta: origen, dirección y luz libre entre jambas, sobre la cuerda si el muro es curvo. */
export interface OpeningFrame { origin: Point; direction: Point; spanMm: number; frameMm: number; wallThicknessMm: number }

/** Ancho del marco del modelo 3D: el del tipo, sin pasar de un octavo del hueco. */
export function openingFrameMm(opening: Opening): number {
  return Math.min(openingType(opening)?.frameMm ?? 45, opening.widthMm / 8, openingConstruction(opening).heightMm / 8);
}

export function openingFrame(doc: EditorDocument, opening: Opening): OpeningFrame | null {
  const wall = doc.walls.find((item) => item.id === opening.wallId);
  if (!wall) return null;
  const path = wallPath(doc, wall), frameMm = openingFrameMm(opening);
  if (!wall.curveHeightMm) return { origin: path.at(opening.position), direction: path.tangent(opening.position),
    spanMm: opening.widthMm - 2 * frameMm, frameMm, wallThicknessMm: wall.thicknessMm };
  // Igual que las hojas rígidas del muro curvo: la luz es la cuerda entre las caras interiores de las jambas.
  const half = opening.widthMm / path.length / 2, inset = frameMm / path.length;
  const a = path.at(opening.position - half + inset), b = path.at(opening.position + half - inset);
  const spanMm = Math.hypot(b.x - a.x, b.y - a.y);
  return { origin: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    direction: spanMm ? { x: (b.x - a.x) / spanMm, y: (b.y - a.y) / spanMm } : path.tangent(opening.position),
    spanMm, frameMm, wallThicknessMm: wall.thicknessMm };
}

/** La misma hoja en coordenadas del plano: ángulos absolutos y puntos en milímetros del documento. */
export type WorldLeaf = LeafPanel;
export interface WorldLeafLayout {
  type: OpeningType; frame: OpeningFrame; leaves: WorldLeaf[]; travel: Point[][]; rail?: { from: Point; to: Point };
  overhead?: Point[]; lift?: number;
}

/** Las hojas en coordenadas del plano, con la misma luz que el modelo 3D (también en muros curvos). */
export function worldOpeningLeaves(doc: EditorDocument, opening: Opening): WorldLeafLayout | null {
  const frame = openingFrame(doc, opening);
  const layout = frame && openingLeafLayout(opening, frame.spanMm, frame.wallThicknessMm);
  if (!frame || !layout) return null;
  const { origin, direction } = frame, base = Math.atan2(direction.y, direction.x);
  const world = (p: Point): Point => ({ x: origin.x + direction.x * p.x - direction.y * p.y, y: origin.y + direction.y * p.x + direction.x * p.y });
  return { type: layout.type, frame,
    leaves: layout.panels.map((panel) => ({ ...panel, center: world(panel.center), angle: base + panel.angle,
      ...(panel.hinge ? { hinge: { ...panel.hinge, pivot: world(panel.hinge.pivot), closedAngle: base + panel.hinge.closedAngle } } : {}) })),
    travel: layout.travel.map((polygon) => polygon.map(world)),
    ...(layout.rail ? { rail: { from: world(layout.rail.from), to: world(layout.rail.to) } } : {}),
    ...(layout.overhead ? { overhead: layout.overhead.map(world), lift: layout.lift } : {}) };
}

/** Extremos de una hoja: desde la bisagra (o el extremo inicial) hasta el canto libre. */
export function leafEnds(leaf: Pick<LeafPanel, 'center' | 'angle' | 'lengthMm'>): [Point, Point] {
  const dx = Math.cos(leaf.angle) * leaf.lengthMm / 2, dy = Math.sin(leaf.angle) * leaf.lengthMm / 2;
  return [{ x: leaf.center.x - dx, y: leaf.center.y - dy }, { x: leaf.center.x + dx, y: leaf.center.y + dy }];
}
