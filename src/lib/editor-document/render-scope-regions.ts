import type { EditorDocument } from './schema';
import type { RenderDesignOptions } from './render-design-options';
import { eligibleCeilingRooms } from './ceiling-geometry';

/** «Solo la casa» usa las estancias interiores reales y excluye parcela y patios. */
export function renderScopeRegions(doc: EditorDocument, options: RenderDesignOptions) {
  if (options.designScope !== 'house') return options.regions.map((region) => region.polygon);
  const rooms = eligibleCeilingRooms(doc);
  if (!rooms.length) throw new Error('No hay estancias interiores cerradas para el ámbito Solo la casa.');
  return rooms.map((room) => room.boundary);
}
