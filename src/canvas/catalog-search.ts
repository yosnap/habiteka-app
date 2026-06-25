/**
 * Búsqueda del catálogo de objetos (Tier 2, paridad Planner5D "buscar objetos").
 *
 * Lógica PURA y testeable: filtra las categorías del catálogo por un texto, casando
 * contra el nombre del objeto, el nombre de su categoría y una lista de SINÓNIMOS por
 * kind (p. ej. "wc" o "váter" → inodoro). Normaliza acentos y mayúsculas para que
 * "lámpara" y "lampara" coincidan.
 */
import { CATALOG, type CatalogCategory } from './catalog';
import type { StructKind } from './types';

/** Palabras alternativas por kind (además del label). Coloquiales y sin acento. */
const SYNONYMS: Partial<Record<StructKind, string[]>> = {
  inodoro: ['wc', 'vater', 'water', 'retrete', 'taza'],
  lavabo: ['pila', 'lavamanos'],
  banera: ['tina', 'jacuzzi'],
  bidet: ['bide'],
  fregadero: ['pila', 'lavaplatos'],
  encimera: ['mostrador', 'meson'],
  nevera: ['frigo', 'frigorifico', 'refrigerador', 'heladera'],
  horno: ['hornilla', 'cocina'],
  isla: ['isla cocina'],
  cama: ['lecho'],
  sofa: ['sillon', 'canape', 'couch'],
  mesa: ['mesita', 'escritorio'],
  silla: ['asiento', 'taburete'],
  armario: ['ropero', 'closet', 'guardarropa'],
  estanteria: ['libreria', 'balda', 'repisa'],
  mesilla: ['mesita de noche', 'noche'],
  tv: ['tele', 'television', 'televisor', 'pantalla'],
  ordenador: ['pc', 'computadora', 'computador'],
  lampara: ['luz', 'flexo'],
  alfombra: ['tapete', 'moqueta'],
  planta: ['maceta', 'verde'],
  chimenea: ['hogar', 'fuego'],
  foco: ['luz', 'spot', 'punto de luz'],
  window: ['ventanal', 'cristalera'],
  door: ['acceso', 'entrada'],
};

/** Rango de diacríticos combinantes (acentos) en Unicode, para quitarlos tras NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normaliza para comparar: minúsculas, sin acentos ni diacríticos. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').trim();
}

/** ¿El item (por kind y label) casa con el término ya normalizado? */
function itemMatches(kind: StructKind, label: string, term: string): boolean {
  if (normalize(label).includes(term)) return true;
  const syns = SYNONYMS[kind];
  return syns ? syns.some((s) => normalize(s).includes(term)) : false;
}

/**
 * Filtra el catálogo por texto. Devuelve las categorías que conservan algún item
 * coincidente (con sus items ya filtrados). Con texto vacío devuelve `categories`
 * tal cual. Una categoría también casa entera si el término coincide con su nombre.
 */
export function searchCatalog(
  categories: CatalogCategory[],
  query: string,
): CatalogCategory[] {
  const term = normalize(query);
  if (!term) return categories;

  return categories
    .map((cat) => {
      // Si el término casa con el nombre de la categoría, se muestran todos sus items.
      if (normalize(cat.label).includes(term)) return cat;
      const items = cat.items.filter((it) => itemMatches(it.kind, it.label, term));
      return { ...cat, items };
    })
    .filter((cat) => cat.items.length > 0);
}

/** Conveniencia: busca sobre el catálogo completo. */
export function searchFullCatalog(query: string): CatalogCategory[] {
  return searchCatalog(CATALOG, query);
}
