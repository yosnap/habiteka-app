/**
 * Tipo de carpintería que la lectura distingue en el símbolo de una puerta o ventana (más allá de puerta, ventana o
 * hueco) y su paso al tipo del catálogo del editor (`opening-types.ts`). Sin variante, la abertura conserva su tipo
 * básico y sus medidas de siempre. Puro y sin IA.
 */
import type { ApertureKind } from '@/lib/contracts';

export const APERTURE_VARIANTS = ['entrada', 'doble', 'corredera', 'plegable', 'balconera', 'granero', 'corredera-central', 'garaje'] as const;
export type ApertureVariant = (typeof APERTURE_VARIANTS)[number];

/** Variantes válidas de cada clase: una ventana no es «de entrada» ni una puerta «balconera»; un hueco no tiene hoja. */
const VARIANTS_BY_KIND: Readonly<Record<ApertureKind, readonly ApertureVariant[]>> = {
  puerta: ['entrada', 'doble', 'corredera', 'plegable', 'granero', 'corredera-central', 'garaje'],
  ventana: ['balconera', 'corredera'],
  hueco: [],
};

/** Variante leída, solo si corresponde a su clase; cualquier otro valor se descarta sin fallar. */
export function parseApertureVariant(kind: ApertureKind, value: unknown): ApertureVariant | undefined {
  return typeof value === 'string' && (VARIANTS_BY_KIND[kind] as readonly string[]).includes(value)
    ? value as ApertureVariant : undefined;
}

/** Una corredera de este ancho o más es la de vidrio de dos hojas que sale a un patio o una terraza. */
export const WIDE_SLIDING_DOOR_MM = 1400;
/** Desde este ancho, la corredera de vidrio a patio es la elevadora de cuatro hojas. */
export const FOUR_LEAF_SLIDING_DOOR_MM = 2800;

// Ancho por defecto (mm) cuando el boceto no lo insinúa y máximo plausible de cada clase: un «hueco» de 2,5 m es una
// banda mal partida, no una puerta.
const DEFAULT_WIDTH_MM: Readonly<Record<ApertureKind, number>> = { puerta: 900, ventana: 1200, hueco: 900 };
const MAX_WIDTH_MM: Readonly<Record<ApertureKind, number>> = { puerta: 1100, ventana: 2600, hueco: 2000 };
// Una puerta de dos hojas, una corredera o una plegable reconocidas pueden ser bastante más anchas que una abatible.
const DOOR_VARIANT_WIDTH_MM: Readonly<Partial<Record<ApertureVariant, { defaultMm: number; maxMm: number }>>> = {
  entrada: { defaultMm: 950, maxMm: 1200 },
  doble: { defaultMm: 1400, maxMm: 1800 },
  corredera: { defaultMm: 900, maxMm: 4000 },
  plegable: { defaultMm: 800, maxMm: 2400 },
  granero: { defaultMm: 1000, maxMm: 1500 },
  'corredera-central': { defaultMm: 1400, maxMm: 2400 },
  garaje: { defaultMm: 2500, maxMm: 5000 },
};

export function apertureWidthLimits(kind: ApertureKind, variante?: ApertureVariant): { defaultMm: number; maxMm: number } {
  const door = kind === 'puerta' && variante ? DOOR_VARIANT_WIDTH_MM[variante] : undefined;
  return door ?? { defaultMm: DEFAULT_WIDTH_MM[kind], maxMm: MAX_WIDTH_MM[kind] };
}

/** Tipo del catálogo del editor que corresponde a la variante leída; `undefined` deja el básico. */
export function apertureCatalogId(kind: ApertureKind, variante: ApertureVariant | undefined, widthMm: number): string | undefined {
  if (!variante || !(VARIANTS_BY_KIND[kind] as readonly string[]).includes(variante)) return undefined;
  if (kind === 'ventana') return variante === 'balconera' ? 'ventana-balconera' : 'ventana-corredera';
  switch (variante) {
    case 'entrada': return 'puerta-entrada';
    case 'doble': return 'puerta-doble';
    case 'corredera': return widthMm >= FOUR_LEAF_SLIDING_DOOR_MM ? 'puerta-corredera-elevadora'
      : widthMm >= WIDE_SLIDING_DOOR_MM ? 'puerta-corredera-vidrio' : 'puerta-corredera';
    case 'granero': return 'puerta-granero';
    case 'corredera-central': return 'puerta-corredera-central';
    case 'garaje': return 'puerta-garaje';
    default: return 'puerta-plegable';
  }
}

/**
 * Puerta que se reconoce por su hoja aunque no se vea arco de barrido: corredera (vista, de granero o de dos hojas al
 * centro), plegable, de dos hojas o seccional de garaje.
 */
export function leafWithoutArc(variante?: ApertureVariant): boolean {
  return variante === 'doble' || variante === 'corredera' || variante === 'plegable' || variante === 'granero'
    || variante === 'corredera-central' || variante === 'garaje';
}

/** Lo mismo para una abertura ya anclada, por su tipo del catálogo (las de entrada se reconocen por su arco). */
export function recognizedLeafType(catalogId?: string): boolean {
  return !!catalogId && catalogId.startsWith('puerta-') && !catalogId.startsWith('puerta-entrada');
}
