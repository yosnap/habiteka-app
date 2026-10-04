import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from './furniture-catalog';
import type { NativeDesignFurniture } from './native-design-proposal';
import { originFromCentre } from './proposal-coordinates';
import { localToWorld } from './spatial-properties';

/**
 * Piezas que van en conjunto con otra: sillas alrededor de la mesa, mesillas a los lados del cabecero y la mesa de
 * centro delante del sofá. La IA calculaba mal su sitio (la silla dentro de la mesa, la mesilla en otra pared) y casi
 * todas se descartaban; la IA elige el modelo y el código las coloca respecto a la pieza principal ya validada.
 */
export function isDiningTable(entry: FurnitureCatalogEntry | undefined): boolean {
  return !!entry && entry.profile === 'table' && (entry.room === 'comedor' || entry.id === 'habiteka:furniture:mesa-jardin');
}
export function isDiningChair(entry: FurnitureCatalogEntry | undefined): boolean {
  return !!entry && entry.profile === 'chair' && (entry.room === 'comedor' || entry.id === 'habiteka:furniture:silla-jardin');
}
export function defaultDiningChair(table: FurnitureCatalogEntry): string {
  return table.room === 'exterior' ? 'habiteka:furniture:silla-jardin' : 'habiteka:furniture:silla-comedor';
}

const isBed = (entry: FurnitureCatalogEntry | undefined) => entry?.profile === 'bed';
const isSofa = (entry: FurnitureCatalogEntry | undefined) => !!entry?.profile.startsWith('sofa');
export const isBedsideTable = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'cabinet' && entry.id.includes('mesita');
export const isCoffeeTable = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.profile === 'table' && /mesa[-_]centro/.test(entry.id);
const isRug = (entry: FurnitureCatalogEntry | undefined) => entry?.profile === 'rug';

/** Conjunto: qué pieza manda, qué la acompaña, el modelo si la IA no eligió ninguno y dónde va cada acompañante. */
export interface CompanionRule {
  /** Qué acompaña; sin modelo por defecto, una vez por estancia de cada tipo (una alfombra no sale dos veces). */
  name: string;
  anchor: (entry: FurnitureCatalogEntry | undefined) => boolean;
  companion: (entry: FurnitureCatalogEntry | undefined) => boolean;
  /** Sin modelo por defecto, solo se pone si la IA lo pidió en esa estancia, y una vez por estancia. */
  fallback?: (anchor: FurnitureCatalogEntry) => string;
  /** `snug` mete la silla bajo la mesa; sin él (si así choca), queda tocando el canto. */
  place: (anchor: NativeDesignFurniture, companionId: string, snug?: boolean) => NativeDesignFurniture[];
  /** Con una sola plaza (cama individual), basta el primer acompañante que cabe. */
  single?: (anchor: FurnitureCatalogEntry) => boolean;
}
export const COMPANION_RULES: readonly CompanionRule[] = [
  { name: 'sillas', anchor: isDiningTable, companion: isDiningChair, fallback: defaultDiningChair, place: (table, chair, snug) => diningChairs(table, chair, snug) },
  { name: 'mesillas', anchor: isBed, companion: isBedsideTable, fallback: () => 'habiteka:furniture:mesita', place: (bed, table) => bedsideTables(bed, table),
    single: (bed) => bed.widthMm < 1200 },
  { name: 'mesa de centro', anchor: isSofa, companion: isCoffeeTable, place: (sofa, table) => coffeeTable(sofa, table) },
  { name: 'alfombra', anchor: isSofa, companion: isRug, place: (sofa, rug) => rugBefore(sofa, rug) },
  { name: 'alfombra', anchor: isDiningTable, companion: isRug, place: (table, rug) => rugUnder(table, rug) },
];

/** Centro de un acompañante en el marco de su pieza principal, con su giro relativo, convertido al plano. */
function companion(anchor: NativeDesignFurniture, anchorEntry: FurnitureCatalogEntry, entry: FurnitureCatalogEntry,
  local: { x: number; y: number; turn: number }, reason: string): NativeDesignFurniture {
  const frame = { x: anchor.xMm, y: anchor.yMm, rotation: anchor.rotation, widthMm: anchorEntry.widthMm, depthMm: anchorEntry.depthMm };
  const centre = localToWorld(frame, local), rotation = ((anchor.rotation + local.turn) % 360 + 360) % 360;
  const origin = originFromCentre(centre.x, centre.y, rotation, entry.widthMm, entry.depthMm);
  return { catalogId: entry.id, xMm: origin.x, yMm: origin.y, rotation, reason };
}

/** Mesillas pegadas a cada lado del cabecero, con la trasera en el mismo muro que la cama. */
export function bedsideTables(bed: NativeDesignFurniture, tableId: string): NativeDesignFurniture[] {
  const bedEntry = getFurnitureCatalogEntry(bed.catalogId), entry = getFurnitureCatalogEntry(tableId);
  if (!bedEntry || !entry) return [];
  return [-entry.widthMm / 2, bedEntry.widthMm + entry.widthMm / 2].map((x) =>
    companion(bed, bedEntry, entry, { x, y: entry.depthMm / 2, turn: 0 }, 'Mesilla junto al cabecero'));
}

/** Mesa de centro delante del sofá, centrada y con 40 cm de paso para las piernas. */
export function coffeeTable(sofa: NativeDesignFurniture, tableId: string): NativeDesignFurniture[] {
  const sofaEntry = getFurnitureCatalogEntry(sofa.catalogId), entry = getFurnitureCatalogEntry(tableId);
  if (!sofaEntry || !entry) return [];
  return [companion(sofa, sofaEntry, entry, { x: sofaEntry.widthMm / 2, y: sofaEntry.depthMm + 400 + entry.depthMm / 2, turn: 0 }, 'Mesa de centro delante del sofá')];
}

/** Alfombra delante del sofá, centrada con él y con su borde 25 cm bajo el frente: pisa el sofá y la mesa de centro. */
export function rugBefore(sofa: NativeDesignFurniture, rugId: string): NativeDesignFurniture[] {
  const sofaEntry = getFurnitureCatalogEntry(sofa.catalogId), entry = getFurnitureCatalogEntry(rugId);
  if (!sofaEntry || !entry) return [];
  return [companion(sofa, sofaEntry, entry, { x: sofaEntry.widthMm / 2, y: sofaEntry.depthMm - 250 + entry.depthMm / 2, turn: 0 }, 'Alfombra bajo el sofá y la mesa de centro')];
}

/** Alfombra centrada bajo la mesa de comedor, con su mismo giro. */
export function rugUnder(table: NativeDesignFurniture, rugId: string): NativeDesignFurniture[] {
  const tableEntry = getFurnitureCatalogEntry(table.catalogId), entry = getFurnitureCatalogEntry(rugId);
  if (!tableEntry || !entry) return [];
  return [companion(table, tableEntry, entry, { x: tableEntry.widthMm / 2, y: tableEntry.depthMm / 2, turn: 0 }, 'Alfombra bajo la mesa')];
}

/** Hueco de cada comensal a lo largo de la mesa y largo a partir del cual caben las cabeceras. */
const PLACE_MM = 600, HEAD_FROM_MM = 1600;
/** Lo que el asiento entra bajo el tablero, como en un comedor real; el respaldo queda fuera. */
const TUCK_RATIO = .38, TUCK_MAX_MM = 220;

export function diningChairs(table: NativeDesignFurniture, chairId: string, snug = true): NativeDesignFurniture[] {
  const tableEntry = getFurnitureCatalogEntry(table.catalogId), chair = getFurnitureCatalogEntry(chairId);
  if (!tableEntry || !chair) return [];
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
