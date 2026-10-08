import { getFurnitureCatalogEntry } from './furniture-catalog';

/** Capa de pintado en planta: la alfombra debajo de todo, después las sillas y bancos que entran bajo la mesa. */
function layer(item: { catalogId?: string }): number {
  const profile = getFurnitureCatalogEntry(item.catalogId ?? '')?.profile;
  return profile === 'rug' ? 0 : profile === 'chair' || profile === 'bench' ? 1 : 2;
}

/**
 * Orden en que se pintan los objetos en la vista cenital: alfombras, asientos, el resto y, al final, lo que está más
 * alto (una lámpara sobre la mesilla). Se pintaban por orden de creación y una alfombra tapaba el sofá o una silla la mesa.
 */
export function planDrawOrder<T extends { catalogId?: string; elevationMm?: number }>(items: readonly T[]): T[] {
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => layer(a.item) - layer(b.item) || (a.item.elevationMm ?? 0) - (b.item.elevationMm ?? 0) || a.index - b.index)
    .map(({ item }) => item);
}
