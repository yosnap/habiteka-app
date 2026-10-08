import type { Furniture } from './schema';
import { getFurnitureCatalogEntry, type FurnitureProfile } from './furniture-catalog';
import { windowCoverage } from './furniture-profiles';
import { HABITEKA_MODEL_PREFIX, HABITEKA_REGISTRY } from './habiteka-furniture';

/**
 * Cortinas, estores y persianas se ven con modelos de la fábrica (families/textiles.mjs), pero no con uno solo: cada
 * producto tiene un ESTADO por medida nominal y cobertura (`<producto>_<cm>_c<%>`). Se elige el más cercano a la pieza
 * para que, al escalarlo a la ventana, la onda de la cortina o el paso de las lamas no se deformen y la cobertura
 * regulable se vea. El ancho fija el paso de la onda y de las lamas verticales; el alto, el de las lamas horizontales y
 * el grueso del tubo o del cajón.
 */
type Axis = 'width' | 'height';
interface DressingState { id: string; sizeMm: number; coverage: number }

const PRODUCTS: Partial<Record<FurnitureProfile, (material: string) => { product: string; axis: Axis }>> = {
  curtain: () => ({ product: 'cortina_onda', axis: 'width' }),
  'curtain-open': () => ({ product: 'cortina_onda', axis: 'width' }),
  roller: () => ({ product: 'estor_enrollable', axis: 'height' }),
  venetian: (material) => ({ product: material === 'Madera' ? 'veneciana_madera' : 'veneciana_aluminio', axis: 'height' }),
  'vertical-blind': () => ({ product: 'cortina_vertical', axis: 'width' }),
  shutter: () => ({ product: 'persiana_exterior', axis: 'height' }),
};

const STATE_ID = /^([a-z_]+?)_(\d+)_c(\d+)$/;
/** Estados generados de cada producto, leídos del registro de la fábrica (sin listas a mano). */
const STATES = new Map<string, DressingState[]>();
for (const entry of HABITEKA_REGISTRY) {
  const match = entry.hidden ? STATE_ID.exec(entry.id) : null;
  if (!match) continue;
  const list = STATES.get(match[1]!) ?? [];
  list.push({ id: `${HABITEKA_MODEL_PREFIX}${entry.id}`, sizeMm: Number(match[2]) * 10, coverage: Number(match[3]) / 100 });
  STATES.set(match[1]!, list);
}

/**
 * Id del modelo (habiteka:model:…) con que se ve una cortina, estor o persiana del catálogo, o undefined si la pieza no
 * es un textil de ventana o falta su estado. Medida más cercana en proporción y, dentro de ella, cobertura más cercana.
 */
export function windowDressingModelId(item: Pick<Furniture, 'catalogId'> & Partial<Pick<Furniture, 'widthMm' | 'heightMm' | 'coverage'>>): string | undefined {
  const entry = getFurnitureCatalogEntry(item.catalogId);
  const choice = entry && PRODUCTS[entry.profile]?.(entry.material);
  const states = choice && STATES.get(choice.product);
  if (!entry || !choice || !states?.length) return undefined;
  const size = choice.axis === 'width' ? item.widthMm ?? entry.widthMm : item.heightMm ?? entry.heightMm;
  const coverage = windowCoverage({ catalogId: item.catalogId, coverage: item.coverage });
  const distance = (state: DressingState) => Math.abs(Math.log(state.sizeMm / Math.max(size, 1)));
  const nearest = Math.min(...states.map(distance));
  return states.filter((state) => distance(state) === nearest)
    .reduce((best, state) => Math.abs(state.coverage - coverage) < Math.abs(best.coverage - coverage) ? state : best).id;
}
