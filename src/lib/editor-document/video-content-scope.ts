import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { eligibleCeilingRooms } from './ceiling-geometry';
import type { ZoneMaskRegions } from './render-view';

export type VideoContentScope = 'house' | 'all';

/** Comparte la definición de interiores de «Solo la casa» con las imágenes. */
export function videoScopeRegions(doc: EditorDocument, scope: VideoContentScope): ZoneMaskRegions {
  if (scope === 'all') return [];
  const regions = buildingDocuments(doc).flatMap(level => eligibleCeilingRooms(level.document).map(room => room.boundary));
  if (!regions.length) throw new Error('Solo la casa necesita estancias interiores cerradas. Revisa el plano.');
  return regions;
}
