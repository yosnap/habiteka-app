import type { EditorDocument } from './schema';

/**
 * Cubiertas exteriores que tapan lo que hay debajo desde arriba: pérgolas, carpas (con sus laterales transparentes),
 * toldos y sombrillas. En una vista cenital o aérea se quitan; un toldo o una sombrilla equivale a estar recogido.
 */
const VIEW_COVER_KINDS = new Set(['pergola', 'pergola-aluminio', 'pergola-metal', 'carpa', 'toldo', 'sombrilla']);

/** Vistas desde arriba en las que una cubierta estorba: cenital, isométrica y dron. */
export const AERIAL_VIEWS = new Set(['top', 'isometric', 'drone']);

export function isViewCover(item: { kind: string }): boolean {
  return VIEW_COVER_KINDS.has(item.kind);
}

/** Ids de las cubiertas de un plano; vacío si el plano no tiene ninguna. */
export function viewCoverIds(doc: Pick<EditorDocument, 'furniture'>): Set<string> {
  return new Set(doc.furniture.filter(isViewCover).map((item) => item.id));
}
