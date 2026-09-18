import type { Furniture } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
export const CONSTRUCTION_GROUPS = ['Vegetación', 'Cerramientos', 'Pavimentos y parking', 'Agua y drenaje', 'Sombra y equipamiento'] as const;
export function constructionGroup(item: { kind: string; id?: string; catalogId?: string }): string | undefined {
  const id = item.catalogId ?? item.id ?? '';
  if (!id.startsWith('habiteka:outdoor:')) return undefined;
  if (['puf-exterior', 'tira-led'].includes(item.kind)) return undefined;
  if (['arbol', 'arbusto', 'planta-exterior', 'maceta-exterior', 'jardinera-exterior', 'huerto', 'roca', 'piedras', 'setas'].includes(item.kind)) return 'Vegetación';
  if (['valla-madera', 'cerca-metal', 'seto'].includes(item.kind)) return 'Cerramientos';
  if (['parking', 'camino', 'coche'].includes(item.kind)) return 'Pavimentos y parking';
  if (['fuente', 'piscina', 'estanque', 'drenaje', 'sumidero', 'aspersor', 'riego-goteo'].includes(item.kind)) return 'Agua y drenaje';
  return 'Sombra y equipamiento';
}
export function elementName(item: Pick<Furniture, 'name' | 'catalogId' | 'kind'>): string {
  return item.name?.trim() || getFurnitureCatalogEntry(item.catalogId)?.label || CATALOG_BY_KIND[item.kind]?.label || item.kind;
}
