import type { EditorDocument, Furniture } from './schema';
import { isBoundary, planObjects } from './boundary-types';
import { isKitchenRun } from './kitchen-run-types';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { furnitureSpatial, objectCenter, transformAroundCenter, worldToLocal } from './spatial-properties';

/** Perfiles con una cara superior plana sobre la que se apoyan otros objetos. */
const SURFACE_PROFILES = new Set(['cabinet', 'table', 'shelf', 'kitchen', 'bench', 'appliance']);
export function isSurfaceHost(item: Furniture): boolean {
  if (isKitchenRun(item)) return true;
  if (isBoundary(item)) return false;
  const entry = getFurnitureCatalogEntry(item.catalogId);
  return entry ? SURFACE_PROFILES.has(entry.profile) : /mesa|mueble|armario|aparador|comoda|escritorio|encimera|table|cabinet|desk/i.test(item.kind);
}
/**
 * Solo se apoyan encima de otro mueble los objetos que van sobre una superficie: pantallas, plantas, lámparas y pequeños
 * electrodomésticos. Un aparato de pie (cocina con fogones, frigorífico) o un mueble nunca se sube a una encimera.
 */
export function canRestOnHost(item: Furniture): boolean {
  if (isBoundary(item) || isKitchenRun(item)) return false;
  const entry = getFurnitureCatalogEntry(item.catalogId), heightMm = furnitureSpatial(item).heightMm;
  if (!entry) return heightMm <= 600 && !isSurfaceHost(item);
  if (entry.profile === 'screen' || entry.profile === 'plant') return true;
  return (entry.profile === 'lamp' || entry.profile === 'appliance') && heightMm <= 600;
}
/** Cota de la cara superior: en un mueble de cocina es la encimera. */
export const hostSurfaceTop = (host: Furniture) => { const s = furnitureSpatial(host); return s.elevationMm + s.heightMm; };
function containsCenter(host: Furniture, item: Furniture): boolean {
  const local = worldToLocal(host, objectCenter(item));
  return local.x >= 0 && local.x <= host.widthMm && local.y >= 0 && local.y <= host.depthMm;
}
/** Anfitrión más alto cuya huella contiene el centro del objeto; nunca uno que a su vez se apoye en él. */
export function findHost(doc: EditorDocument, item: Furniture): Furniture | undefined {
  return planObjects(doc)
    .filter((candidate) => candidate.id !== item.id && candidate.hostId !== item.id && isSurfaceHost(candidate) && containsCenter(candidate, item))
    .sort((a, b) => hostSurfaceTop(b) - hostSurfaceTop(a))[0];
}
/**
 * Apoya el objeto en su anfitrión: al ganar uno nuevo toma la cota de su cara superior (y, si se pide, su orientación);
 * si sigue sobre el mismo, sube con él pero respeta una cota puesta a mano más alta; si lo pierde, vuelve al suelo.
 */
export function restOnHost(doc: EditorDocument, item: Furniture, options: { alignRotation?: boolean } = {}): Furniture {
  if (!canRestOnHost(item)) return item.hostId ? { ...item, hostId: undefined } : item;
  const host = findHost(doc, item), catalogElevation = getFurnitureCatalogEntry(item.catalogId)?.elevationMm ?? 0;
  if (!host) return item.hostId ? { ...item, hostId: undefined, elevationMm: catalogElevation } : item;
  const minimum = hostSurfaceTop(host) + catalogElevation;
  if (item.hostId === host.id) return (item.elevationMm ?? 0) >= minimum ? item : { ...item, elevationMm: minimum };
  const rested = { ...item, hostId: host.id, elevationMm: minimum };
  return options.alignRotation && rested.rotation !== host.rotation ? transformAroundCenter(rested, { rotation: host.rotation }) : rested;
}
