/**
 * Acceso de lectura al catálogo curado. En el MVP la fuente es el seed estático;
 * cuando exista sincronización con feeds externos, solo cambiará esta capa sin
 * tocar la UI ni el tracking. Permite filtrar por las categorías de los elementos
 * de un diseño (sugerencias).
 */
import { CATALOG, type CatalogProduct } from './catalog-seed';

/** Devuelve el catálogo completo, o el filtrado por categorías si se indican. */
export function listCatalog(tags?: string[]): CatalogProduct[] {
  if (!tags || tags.length === 0) return CATALOG;
  const wanted = new Set(tags);
  return CATALOG.filter((p) => p.tags.some((t) => wanted.has(t)));
}
