import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from './furniture-catalog';
import type { NativeDesignFurniture } from './native-design-proposal';
import { originFromCentre, sizeForRotation } from './proposal-coordinates';
import { localToWorld } from './spatial-properties';
import { seatOpening } from './l-sofa-shape';

/**
 * Piezas que van en conjunto con otra: sillas alrededor de la mesa, mesillas a los lados del cabecero, la mesa de
 * centro delante del sofá, los taburetes a lo largo de la barra y la lámpara sobre la mesilla. La IA calculaba mal su
 * sitio (la silla dentro de la mesa, la mesilla en otra pared) y casi todas se descartaban; la IA elige el modelo y el
 * código las coloca respecto a la pieza principal ya validada.
 */
export function isDiningTable(entry: FurnitureCatalogEntry | undefined): boolean {
  // Un set ya incluye sus sillas: no se le añaden acompañantes alrededor de la huella completa.
  return !!entry && !entry.productId.startsWith('habiteka-set_comedor_') && entry.profile === 'table'
    && (entry.room === 'comedor' || entry.id === 'habiteka:furniture:mesa-jardin');
}
export function isDiningChair(entry: FurnitureCatalogEntry | undefined): boolean {
  return !!entry && entry.profile === 'chair' && (entry.room === 'comedor' || entry.id === 'habiteka:furniture:silla-jardin');
}
export function defaultDiningChair(table: FurnitureCatalogEntry): string {
  return table.room === 'exterior' ? 'habiteka:furniture:silla-jardin' : 'habiteka:furniture:silla-comedor';
}

const isBed = (entry: FurnitureCatalogEntry | undefined) => entry?.profile === 'bed';
const isSofa = (entry: FurnitureCatalogEntry | undefined) => !!entry?.profile.startsWith('sofa');
// Las mesillas de Poly Haven se llaman «mesilla»; la del catálogo propio, «mesita».
export const isBedsideTable = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'cabinet' && /mesita|mesilla/.test(entry.id);
export const isCoffeeTable = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'table' && /mesa[-_]centro/.test(entry.id);
// Un felpudo es de la puerta de entrada: no va bajo el sofá ni bajo la mesa.
const isRug = (entry: FurnitureCatalogEntry | undefined) => entry?.profile === 'rug' && !entry.id.includes('felpudo');
/** Barra de la cocina americana: la isla o península de cocina o una mesa alta. */
export const isBarCounter = (entry: FurnitureCatalogEntry | undefined) => !!entry && (entry.id.startsWith('habiteka:furniture:isla-cocina') || /mesa[-_]alta/.test(entry.id));
export const isBarStool = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'chair' && entry.id.includes('taburete');
/** Lámpara que se apoya en un tablero; la de escritorio y el flexo van en la mesa de trabajo. */
export const isTableLamp = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'lamp' && entry.heightMm <= 600
  && !/escritorio|flexo/.test(entry.id);
const isTvUnit = (entry: FurnitureCatalogEntry | undefined) => !!entry && /mueble[-_]tv/.test(entry.id);
export const isTelevision = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'screen' && entry.room === 'salon';

/** Conjunto: qué pieza manda, qué la acompaña, el modelo si la IA no eligió ninguno y dónde va cada acompañante. */
export interface CompanionRule {
  /** Qué acompaña; sin modelo por defecto, una vez por estancia de cada tipo (una alfombra no sale dos veces). */
  name: string;
  anchor: (entry: FurnitureCatalogEntry | undefined) => boolean;
  companion: (entry: FurnitureCatalogEntry | undefined) => boolean;
  /** Sin modelo por defecto, solo se pone si la IA lo pidió en esa estancia, y una vez por estancia. */
  fallback?: (anchor: FurnitureCatalogEntry) => string;
  /**
   * `snug` mete la silla bajo la mesa; sin él (si así choca), queda tocando el canto. `sizeMm` es la medida propia del
   * acompañante en los ejes del plano (una alfombra dibujada).
   */
  place: (anchor: NativeDesignFurniture, companionId: string, snug?: boolean, sizeMm?: { x: number; y: number }) => NativeDesignFurniture[];
  /** Con una sola plaza (cama individual), basta el primer acompañante que cabe. */
  single?: (anchor: FurnitureCatalogEntry) => boolean;
  /**
   * Sin modelo por defecto, también va en cada pieza principal de la estancia y no solo en la primera: la lámpara, en
   * cada mesilla.
   */
  each?: boolean;
}
export const COMPANION_RULES: readonly CompanionRule[] = [
  { name: 'sillas', anchor: isDiningTable, companion: isDiningChair, fallback: defaultDiningChair, place: (table, chair, snug) => diningChairs(table, chair, snug) },
  { name: 'mesillas', anchor: isBed, companion: isBedsideTable, fallback: () => 'habiteka:furniture:mesita', place: (bed, table) => bedsideTables(bed, table),
    single: (bed) => bed.widthMm < 1200 },
  { name: 'mesa de centro', anchor: isSofa, companion: isCoffeeTable, place: (sofa, table) => coffeeTable(sofa, table) },
  // La alfombra dibujada lleva su medida; si así no cabe, la del catálogo.
  { name: 'alfombra', anchor: isSofa, companion: isRug, place: (sofa, rug, _snug, size) => rugBefore(sofa, rug, size), single: () => true },
  { name: 'alfombra', anchor: isDiningTable, companion: isRug, place: (table, rug, _snug, size) => rugUnder(table, rug, size), single: () => true },
  // Un mueble de TV sin televisor es un aparador: la tele se pone encima, centrada y con la pantalla hacia la estancia.
  { name: 'televisor', anchor: isTvUnit, companion: isTelevision, fallback: () => 'habiteka:furniture:televisor', place: (unit, tv) => onTop(unit, tv),
    single: () => true },
  // Taburetes de la cocina americana: arrimados al frente de la isla o la península, o a los dos lados de una mesa alta.
  { name: 'taburetes', anchor: isBarCounter, companion: isBarStool, place: (bar, stool) => barStools(bar, stool) },
  // La lámpara de mesa pedida en un dormitorio va encima de cada mesilla, como el televisor sobre su mueble.
  { name: 'lámpara', anchor: isBedsideTable, companion: isTableLamp, place: (table, lamp) => onTop(table, lamp, 'Lámpara sobre la mesilla'),
    single: () => true, each: true },
];

/**
 * Centro de un acompañante en el marco de su pieza principal, con su giro relativo, convertido al plano. `size` es su
 * medida propia (ancho × fondo con ese giro), si no usa la del catálogo.
 */
function companion(anchor: NativeDesignFurniture, anchorEntry: FurnitureCatalogEntry, entry: FurnitureCatalogEntry,
  local: { x: number; y: number; turn: number }, reason: string, size?: { widthMm: number; depthMm: number }): NativeDesignFurniture {
  const frame = { x: anchor.xMm, y: anchor.yMm, rotation: anchor.rotation, widthMm: anchorEntry.widthMm, depthMm: anchorEntry.depthMm };
  const centre = localToWorld(frame, local), rotation = ((anchor.rotation + local.turn) % 360 + 360) % 360;
  const origin = originFromCentre(centre.x, centre.y, rotation, size?.widthMm ?? entry.widthMm, size?.depthMm ?? entry.depthMm);
  return { catalogId: entry.id, xMm: origin.x, yMm: origin.y, rotation, reason, ...(size ?? {}) };
}

/** Medida de una alfombra dibujada con el giro de su pieza principal: primero a su medida y después la del catálogo. */
function rugSizes(anchor: NativeDesignFurniture, sizeMm: { x: number; y: number } | undefined): (({ widthMm: number; depthMm: number }) | undefined)[] {
  return sizeMm ? [sizeForRotation(sizeMm, anchor.rotation), undefined] : [undefined];
}

/** Mesillas pegadas a cada lado del cabecero, con la trasera en el mismo muro que la cama. */
export function bedsideTables(bed: NativeDesignFurniture, tableId: string): NativeDesignFurniture[] {
  const bedEntry = getFurnitureCatalogEntry(bed.catalogId), entry = getFurnitureCatalogEntry(tableId);
  if (!bedEntry || !entry) return [];
  return [-entry.widthMm / 2, bedEntry.widthMm + entry.widthMm / 2].map((x) =>
    companion(bed, bedEntry, entry, { x, y: entry.depthMm / 2, turn: 0 }, 'Mesilla junto al cabecero'));
}

/** Mesa de centro delante del asiento, centrada en su hueco (el de la L en un sofá rinconero) y con 40 cm de paso. */
export function coffeeTable(sofa: NativeDesignFurniture, tableId: string): NativeDesignFurniture[] {
  const sofaEntry = getFurnitureCatalogEntry(sofa.catalogId), entry = getFurnitureCatalogEntry(tableId);
  if (!sofaEntry || !entry) return [];
  const open = seatOpening(sofaEntry.profile, sofaEntry.widthMm, sofaEntry.depthMm);
  return [companion(sofa, sofaEntry, entry, { x: open.widthMm / 2, y: open.depthMm + 400 + entry.depthMm / 2, turn: 0 }, 'Mesa de centro delante del sofá')];
}

/**
 * Alfombra delante del sofá, centrada con él y con su borde 25 cm bajo el frente: pisa el sofá y la mesa de centro. Con
 * la medida dibujada (`sizeMm`, en los ejes del plano), primero a su medida y, si no cabe, la del catálogo.
 */
export function rugBefore(sofa: NativeDesignFurniture, rugId: string, sizeMm?: { x: number; y: number }): NativeDesignFurniture[] {
  const sofaEntry = getFurnitureCatalogEntry(sofa.catalogId), entry = getFurnitureCatalogEntry(rugId);
  if (!sofaEntry || !entry) return [];
  const open = seatOpening(sofaEntry.profile, sofaEntry.widthMm, sofaEntry.depthMm);
  return rugSizes(sofa, sizeMm).map((size) => companion(sofa, sofaEntry, entry,
    { x: open.widthMm / 2, y: open.depthMm - 250 + (size?.depthMm ?? entry.depthMm) / 2, turn: 0 }, 'Alfombra bajo el sofá y la mesa de centro', size));
}

/** Pieza centrada sobre el tablero de otra, con su mismo giro y la trasera del mismo lado. */
export function onTop(base: NativeDesignFurniture, itemId: string, reason = 'Televisor sobre su mueble'): NativeDesignFurniture[] {
  const baseEntry = getFurnitureCatalogEntry(base.catalogId), entry = getFurnitureCatalogEntry(itemId);
  if (!baseEntry || !entry) return [];
  return [companion(base, baseEntry, entry, { x: baseEntry.widthMm / 2, y: baseEntry.depthMm / 2, turn: 0 }, reason)];
}

/** Alfombra centrada bajo la mesa de comedor, con su mismo giro; con la medida dibujada, primero a su medida. */
export function rugUnder(table: NativeDesignFurniture, rugId: string, sizeMm?: { x: number; y: number }): NativeDesignFurniture[] {
  const tableEntry = getFurnitureCatalogEntry(table.catalogId), entry = getFurnitureCatalogEntry(rugId);
  if (!tableEntry || !entry) return [];
  return rugSizes(table, sizeMm).map((size) => companion(table, tableEntry, entry,
    { x: tableEntry.widthMm / 2, y: tableEntry.depthMm / 2, turn: 0 }, 'Alfombra bajo la mesa', size));
}

/** Hueco de cada taburete a lo largo de la barra. */
const STOOL_PLACE_MM = 600;

/**
 * Taburetes de cara a la barra y tocando su canto: a lo largo del frente de la isla o la península (su trasera da a la
 * cocina) y a los dos lados largos de una mesa alta. Caben tantos como huecos de 60 cm.
 */
export function barStools(bar: NativeDesignFurniture, stoolId: string): NativeDesignFurniture[] {
  const barEntry = getFurnitureCatalogEntry(bar.catalogId), stool = getFurnitureCatalogEntry(stoolId);
  if (!barEntry || !stool) return [];
  const { widthMm: width, depthMm: depth } = barEntry, half = stool.depthMm / 2;
  const perSide = Math.max(1, Math.floor(width / STOOL_PLACE_MM));
  const seats: { x: number; y: number; turn: number }[] = [];
  for (let index = 0; index < perSide; index++) {
    const along = width * (index + .5) / perSide;
    seats.push({ x: along, y: depth + half, turn: 180 });
    if (barEntry.profile === 'table') seats.push({ x: along, y: -half, turn: 0 });
  }
  return seats.map((seat) => companion(bar, barEntry, stool, seat, 'Taburete en la barra'));
}

/** Hueco de cada comensal a lo largo de la mesa y largo a partir del cual caben las cabeceras. */
const PLACE_MM = 600, HEAD_FROM_MM = 1600;
/** Lo que el asiento entra bajo el tablero, como en un comedor real; el respaldo queda fuera. */
const TUCK_RATIO = .38, TUCK_MAX_MM = 220;

export function diningChairs(table: NativeDesignFurniture, chairId: string, snug = true): NativeDesignFurniture[] {
  const tableEntry = getFurnitureCatalogEntry(table.catalogId), chair = getFurnitureCatalogEntry(chairId);
  if (!isDiningTable(tableEntry) || !tableEntry || !chair) return [];
  const { widthMm: width, depthMm: depth } = tableEntry;
  const half = chair.depthMm / 2 - (snug ? Math.min(TUCK_MAX_MM, Math.round(chair.depthMm * TUCK_RATIO)) : 0);
  const perSide = Math.max(1, Math.floor(width / PLACE_MM));
  // Centro de cada silla en el marco de la mesa y giro relativo: la trasera de la silla, hacia fuera.
  const seats: { x: number; y: number; turn: number }[] = [];
  for (let index = 0; index < perSide; index++) {
    const along = width * (index + .5) / perSide;
    seats.push({ x: along, y: -half, turn: 0 }, { x: along, y: depth + half, turn: 180 });
  }
  if (width >= HEAD_FROM_MM) seats.push({ x: -half, y: depth / 2, turn: 270 }, { x: width + half, y: depth / 2, turn: 90 });
  return seats.map((seat) => companion(table, tableEntry, chair, seat, 'Silla alrededor de la mesa'));
}
