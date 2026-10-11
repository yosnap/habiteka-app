import type { EditorDocument, Furniture } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { updateFurniture } from './spatial-commands';

export function loungerBackrest(item: Pick<Furniture, 'catalogId'>) {
  const match = /^habiteka:model:tumbona_(teca|aluminio)(_tumbada)?$/.exec(item.catalogId ?? '');
  return match ? { material: match[1]!, raised: !match[2] } : undefined;
}

/** Conserva la escala del mueble al cambiar la posición real del respaldo. */
export function setLoungerBackrest(document: EditorDocument, id: string, raised: boolean): EditorDocument {
  const item = document.furniture.find(entry => entry.id === id);
  const state = item && loungerBackrest(item);
  if (!item || !state) throw new Error('Tumbona no encontrada');
  if (state.raised === raised) return document;
  const previous = getFurnitureCatalogEntry(item.catalogId!)!;
  const next = getFurnitureCatalogEntry(`habiteka:model:tumbona_${state.material}${raised ? '' : '_tumbada'}`);
  if (!next) throw new Error('Posición de respaldo no disponible');
  return updateFurniture(document, id, { catalogId: next.id,
    heightMm: next.heightMm * (item.heightMm ?? previous.heightMm) / previous.heightMm });
}
