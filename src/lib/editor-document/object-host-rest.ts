import type { EditorDocument, Furniture } from './schema';
import { isBoundary, planObjects } from './boundary-types';
import { isKitchenRun } from './kitchen-run-types';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { furnitureSpatial, objectCenter, localToWorld, transformAroundCenter, worldToLocal } from './spatial-properties';

/** Perfiles con una cara superior plana sobre la que se apoyan otros objetos. */
const SURFACE_PROFILES = new Set(['cabinet', 'table', 'shelf', 'kitchen', 'bench', 'appliance', 'bed']);
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
  if (entry.profile === 'decor') return heightMm <= 600;
  return (entry.profile === 'lamp' || entry.profile === 'appliance') && heightMm <= 600;
}
/** Cota de apoyo; la altura total de una cama incluye el cabecero, no solo el colchón. */
export const hostSurfaceTop = (host: Furniture) => {
  const s = furnitureSpatial(host);
  return s.elevationMm + (getFurnitureCatalogEntry(host.catalogId)?.profile === 'bed'
    ? Math.min(680, Math.round(s.heightMm * .68)) : s.heightMm);
};
/** El objeto cabe completo en la cara superior, también cuando está girado. */
export function canFitOnHost(item: Furniture, host: Furniture): boolean {
  if (item.id === host.id || !canRestOnHost(item) || !isSurfaceHost(host) || host.hostId === item.id) return false;
  const angle = (item.rotation - host.rotation) * Math.PI / 180;
  const width = Math.abs(item.widthMm * Math.cos(angle)) + Math.abs(item.depthMm * Math.sin(angle));
  const depth = Math.abs(item.widthMm * Math.sin(angle)) + Math.abs(item.depthMm * Math.cos(angle));
  return width <= host.widthMm + 1 && depth <= host.depthMm + 1;
}
/** Centra un objeto sobre una superficie elegida explícitamente en el plano visual. */
export function placeOnHost(item: Furniture, host: Furniture): Furniture {
  if (!canFitOnHost(item, host)) throw new Error('Este elemento no cabe sobre esa superficie.');
  const center = localToWorld(host, { x: host.widthMm / 2, y: host.depthMm / 2 });
  const offset = objectCenter({ ...item, x: 0, y: 0 });
  return { ...item, x: center.x - offset.x, y: center.y - offset.y,
    hostId: host.id, elevationMm: hostSurfaceTop(host) };
}
/** Un objeto apoyado conserva su posición relativa cuando se mueve o gira el mueble que lo sostiene. */
export function followHostedChildren(doc: EditorDocument, previous: Furniture, next: Furniture): void {
  if (previous.x === next.x && previous.y === next.y && previous.rotation === next.rotation) return;
  for (const child of doc.furniture) {
    if (child.hostId !== previous.id) continue;
    const local = worldToLocal(previous, objectCenter(child));
    const center = localToWorld(next, local);
    const turned = transformAroundCenter(child, { rotation: child.rotation + next.rotation - previous.rotation });
    const offset = objectCenter({ ...turned, x: 0, y: 0 });
    Object.assign(child, { rotation: turned.rotation, x: center.x - offset.x, y: center.y - offset.y });
  }
}
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
  const preferred = item.hostId && planObjects(doc).find((candidate) => candidate.id === item.hostId);
  const host = preferred && isSurfaceHost(preferred) && containsCenter(preferred, item) ? preferred : findHost(doc, item);
  const catalogElevation = getFurnitureCatalogEntry(item.catalogId)?.elevationMm ?? 0;
  if (!host) return item.hostId ? { ...item, hostId: undefined, elevationMm: catalogElevation } : item;
  const minimum = hostSurfaceTop(host);
  if (item.hostId === host.id) return (item.elevationMm ?? 0) >= minimum ? item : { ...item, elevationMm: minimum };
  const rested = { ...item, hostId: host.id, elevationMm: minimum };
  return options.alignRotation && rested.rotation !== host.rotation ? transformAroundCenter(rested, { rotation: host.rotation }) : rested;
}
