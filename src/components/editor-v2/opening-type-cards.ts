import { OPENING_TYPE_GROUP_NAMES, openingTypeGroup, openingTypesFor, type OpeningTypeGroup, type OpeningTypeKind }
  from '@/lib/editor-document/opening-types';

/** Tarjeta de Construir → Puertas o Ventanas: un tipo del registro, que se coloca con su herramienta ya elegido. */
export interface OpeningTypeCard {
  typeId: string;
  tool: 'door' | 'window';
  label: string;
  detail: string;
  /** Apartado de la puerta (Interior, Entrada, Correderas, Exterior y garaje); las ventanas no llevan. */
  group: OpeningTypeGroup | null;
}

/** Apartado de Construir con sus tarjetas, en el orden en que se muestran. */
export interface OpeningTypeSection { id: OpeningTypeGroup | 'todas'; title: string | null; cards: OpeningTypeCard[] }

const GROUP_ORDER: readonly OpeningTypeGroup[] = ['interior', 'entrada', 'correderas', 'exterior'];

const meters = new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m = (mm: number) => meters.format(mm / 1000);

/** Una tarjeta por tipo, en el orden del registro, con sus medidas por defecto (ancho × alto y altura del alféizar). */
export function openingTypeCards(kind: OpeningTypeKind): OpeningTypeCard[] {
  return openingTypesFor(kind).map((type) => ({
    typeId: type.id,
    tool: kind === 'puerta' ? 'door' : 'window',
    label: type.name,
    detail: `${m(type.widthMm)} × ${m(type.heightMm)} m${type.elevationMm > 0 ? ` · alféizar a ${m(type.elevationMm)} m` : ''}`,
    group: openingTypeGroup(type),
  }));
}

/**
 * Tarjetas agrupadas por apartado: las puertas, en Interior, Entrada, Correderas y Exterior y garaje para no perderse
 * entre tantos tipos; las ventanas, en un solo bloque sin título. Dentro de cada apartado, el orden del registro.
 */
export function openingTypeSections(kind: OpeningTypeKind): OpeningTypeSection[] {
  const cards = openingTypeCards(kind);
  if (kind !== 'puerta') return [{ id: 'todas', title: null, cards }];
  return GROUP_ORDER.map((group) => ({ id: group, title: OPENING_TYPE_GROUP_NAMES[group], cards: cards.filter((card) => card.group === group) }))
    .filter((section) => section.cards.length > 0);
}
