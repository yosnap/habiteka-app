/**
 * Regeneración PARCIAL del plano 2D: reemplaza solo el subárbol de una zona,
 * dejando el resto del documento idéntico.
 *
 * La clave de la modificación selectiva es no regenerar todo el JSON: se localiza
 * la zona por su id y se sustituye únicamente ese nodo por la versión regenerada.
 * Las demás zonas se conservan por referencia, así que un diff del resultado solo
 * toca la zona editada.
 */
import type { Plano2dPayload, PlanZone } from '@/lib/contracts';

export class ZoneNotFoundError extends Error {
  constructor(zoneId: string) {
    super(`La zona ${zoneId} no existe en el plano`);
    this.name = 'ZoneNotFoundError';
  }
}

/**
 * Devuelve un nuevo plano con la zona `zoneId` reemplazada por `regenerated`. El
 * resto de zonas se mantienen por referencia (sin cambios). Lanza si la zona no
 * existe (no se inventa una nueva: el feedback siempre opera sobre algo presente).
 */
export function replaceZone(
  plano: Plano2dPayload,
  zoneId: string,
  regenerated: PlanZone,
): Plano2dPayload {
  const index = plano.zones.findIndex((z) => z.id === zoneId);
  if (index === -1) {
    throw new ZoneNotFoundError(zoneId);
  }
  // Conserva el id de la zona aunque el regenerado traiga otro: la identidad de
  // la zona es estable entre versiones (referencias de votación/marketplace).
  const next: PlanZone = { ...regenerated, id: zoneId };
  const zones = plano.zones.map((z, i) => (i === index ? next : z));
  return { ...plano, zones };
}

/** Verdadero si todas las zonas distintas de `zoneId` siguen siendo idénticas. */
export function onlyZoneChanged(
  before: Plano2dPayload,
  after: Plano2dPayload,
  zoneId: string,
): boolean {
  const others = (p: Plano2dPayload) => p.zones.filter((z) => z.id !== zoneId);
  const a = others(before);
  const b = others(after);
  if (a.length !== b.length) return false;
  return a.every((z, i) => z === b[i]);
}
