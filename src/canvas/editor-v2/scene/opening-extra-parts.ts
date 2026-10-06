import type { Opening } from '@/lib/editor-document/schema';
import type { LeafLayout } from '@/lib/editor-document/opening-leaves';
import type { OpeningLook } from '@/lib/editor-document/opening-look';
import type { OpeningType } from '@/lib/editor-document/opening-types';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { liftsOverhead } from '@/lib/editor-document/opening-types';
import { ROLLER_BOX_MM } from '@/lib/editor-document/opening-leaves';
import { BARN_LEAF_OVERLAP_MM, GARAGE_HEAD_OVERLAP_MM, type LeafPart } from './opening-leaf-parts';
import type { PartTone } from './opening-part-style';

/** Tapajuntas: ancho de cada tabla, grueso y lo que monta sobre el marco. */
const CASING_MM = 70, CASING_THICKNESS_MM = 12, CASING_OVER_FRAME_MM = 10;
/** Pletina de la guía de granero, su separación sobre la hoja y el diámetro de las ruedas. */
const BARN_RAIL_MM = 36, BARN_RAIL_GAP_MM = 50, BARN_WHEEL_MM = 92;
/** Guías de la seccional: más allá del alto de la puerta para su curva bajo el techo. */
const GARAGE_TRACK_EXTRA_MM = 300;

const piece = (along: number, y: number, length: number, height: number, thickness: number, across: number, tone: PartTone,
  role: LeafPart['role'] = 'frame', shape?: LeafPart['shape']): LeafPart =>
  ({ role, along, y, length, height, thickness, across, tone, ...(shape ? { shape } : {}) });

export interface OpeningExtraDims { widthMm: number; heightMm: number; frameMm: number; wallThicknessMm: number; depthMm: number; casing: boolean }

/** Tapajuntas en cada cara del muro, a juego con el marco: tapan la junta entre el marco y la pared. */
function casing({ widthMm, heightMm, wallThicknessMm }: OpeningExtraDims, faces: readonly (1 | -1)[]): LeafPart[] {
  const inner = widthMm / 2 - CASING_OVER_FRAME_MM, top = heightMm - CASING_OVER_FRAME_MM + CASING_MM;
  return faces.flatMap((face) => {
    const across = face * (wallThicknessMm / 2 + CASING_THICKNESS_MM / 2);
    return [-1, 1].map((end) => piece(end * (inner + CASING_MM / 2), top / 2, CASING_MM, top, CASING_THICKNESS_MM, across, 'frame'))
      .concat(piece(0, top - CASING_MM / 2, 2 * (inner + CASING_MM), CASING_MM, CASING_THICKNESS_MM, across, 'frame'));
  });
}

/** Guía de pletina negra con sus separadores, topes, ruedas y colgadores de cada hoja de granero. */
function barnHardware(layout: LeafLayout, dims: OpeningExtraDims, side: 1 | -1): LeafPart[] {
  const rail = layout.rail!, across = rail.from.y, railY = dims.heightMm + BARN_LEAF_OVERLAP_MM + BARN_RAIL_GAP_MM;
  const from = rail.from.x, to = rail.to.x, wall = dims.wallThicknessMm / 2, standoff = Math.abs(across) - wall;
  const wheelY = railY + BARN_RAIL_MM / 2 + BARN_WHEEL_MM / 2, strapBottom = dims.heightMm + BARN_LEAF_OVERLAP_MM - 170;
  const parts = [piece((from + to) / 2, railY, to - from, BARN_RAIL_MM, 10, across, 'iron'),
    ...[from + 30, (from + to) / 2, to - 30].map((x) => piece(x, railY, 26, 26, standoff, side * (wall + standoff / 2), 'iron')),
    ...[from + 12, to - 12].map((x) => piece(x, railY + BARN_RAIL_MM / 2 + 14, 24, 28, 22, across, 'iron'))];
  for (const panel of layout.panels) for (const end of [-1, 1]) {
    const x = panel.center.x + end * (panel.lengthMm / 2 - 130), outer = panel.center.y + side * (panel.thicknessMm / 2 + 3);
    parts.push(piece(x, wheelY, BARN_WHEEL_MM, BARN_WHEEL_MM, 22, across, 'iron', 'frame', 'ellipsoid'),
      piece(x, wheelY, 24, 24, 34, across + side * 6, 'steel', 'frame', 'ellipsoid'),
      piece(x, (strapBottom + wheelY) / 2, 40, wheelY - strapBottom, 6, outer, 'iron'));
  }
  return parts;
}

/**
 * Herrajes de las puertas de garaje que suben: guías verticales en las jambas y, según el tipo, las guías bajo el techo
 * con su eje de muelles (seccional), el cajón de la persiana (enrollable) o, abierta, la hoja horizontal (seccional y
 * basculante, esta asomando un tercio a la calle).
 */
function garageHardware(type: OpeningType, layout: LeafLayout, dims: OpeningExtraDims, side: 1 | -1): LeafPart[] {
  const panel = layout.panels[0], wall = dims.wallThicknessMm / 2, lift = layout.lift ?? 0, thickness = type.leafThicknessMm;
  if (!panel) return [];
  const roller = type.operation === 'enrollable', top = dims.heightMm + (roller ? 0 : GARAGE_HEAD_OVERLAP_MM);
  const leafAcross = panel.center.y, x = panel.lengthMm / 2 + 15;
  const parts = [-1, 1].map((end) => piece(end * x, top / 2, 30, top, roller ? 60 : 50, leafAcross, 'steel'));
  if (roller) return [...parts, piece(0, dims.heightMm + ROLLER_BOX_MM / 2, panel.lengthMm + 80, ROLLER_BOX_MM, ROLLER_BOX_MM,
    side * (wall + ROLLER_BOX_MM / 2), 'leaf', 'leaf')];
  if (type.operation === 'seccional') {
    const depth = dims.heightMm + GARAGE_TRACK_EXTRA_MM;
    parts.push(...[-1, 1].map((end) => piece(end * x, top + 40, 30, 40, depth, side * (wall + depth / 2), 'steel')),
      piece(0, top + 110, 2 * x, 40, 40, side * (wall + 70), 'steel'));
    if (lift > .02) {
      const reach = lift * top;
      parts.push(piece(0, top + 40, panel.lengthMm, thickness, reach, side * (wall + 10 + reach / 2), 'leaf', 'leaf'));
    }
  } else if (lift > .02) {
    // Basculante: la hoja gira sobre la cara interior; abierta, un tercio sale por encima de la calle.
    const outside = lift * top / 3, inside = lift * top * 2 / 3, from = -side * (wall + outside), to = side * (wall + inside);
    parts.push(piece(0, top + 40, panel.lengthMm, thickness, Math.abs(to - from), (from + to) / 2, 'leaf', 'leaf'));
  }
  return parts;
}

/**
 * Piezas de la abertura que no pertenecen a una hoja, en coordenadas locales (a lo largo del muro desde el centro y
 * sobre su normal izquierda): tapajuntas de las puertas con aspecto elegido, herrajes de granero, guías de la
 * seccional y montante con su vidrio de la ventana con fijo superior.
 */
export function openingExtraParts(opening: Opening, type: OpeningType, look: OpeningLook, layout: LeafLayout, dims: OpeningExtraDims): LeafPart[] {
  const side: 1 | -1 = openingConstruction(opening).swing === 'left' ? 1 : -1, parts: LeafPart[] = [];
  if (type.kind === 'ventana') {
    if (!type.transomMm) return parts;
    const inner = dims.widthMm - 2 * dims.frameMm, barTop = dims.heightMm - dims.frameMm - type.transomMm;
    return [piece(0, barTop - dims.frameMm / 2, inner, dims.frameMm, dims.depthMm * .6, 0, 'frame'),
      piece(0, (barTop + dims.heightMm - dims.frameMm) / 2, inner, dims.heightMm - dims.frameMm - barTop, 8, 0, 'glass', 'glass')];
  }
  const casingFaces = type.operation === 'corredera' ? [(-side) as 1 | -1] : [1, -1] as const;
  if (look.detailed && dims.casing && !liftsOverhead(type) && type.operation !== 'corredera-marco')
    parts.push(...casing(dims, casingFaces));
  if (type.barn && layout.rail) parts.push(...barnHardware(layout, dims, side));
  if (liftsOverhead(type)) parts.push(...garageHardware(type, layout, dims, side));
  return parts;
}
