/**
 * Resolución del estilo/objetivo efectivos de una zona (multi-zona): el override
 * de la zona prevalece sobre lo global del inmueble; lo que la zona no define lo
 * hereda del global. Lógica pura (sin IO) para testearla aislada.
 *
 * `zoneId` null/omitido = plano por defecto del proyecto → usa siempre lo global.
 */
import type { Collected, Estilo } from './contracts';

export interface ResolvedZoneStyle {
  estilo?: Estilo;
  objetivo?: string;
}

export function resolveZoneStyle(
  collected: Collected,
  zoneId?: string | null,
): ResolvedZoneStyle {
  const override = zoneId ? collected.zoneOverrides?.[zoneId] : undefined;
  return {
    estilo: override?.estilo ?? collected.estilo,
    objetivo: override?.objetivo ?? collected.objetivo,
  };
}

/**
 * Devuelve un `Collected` con el override de una zona fijado (inmutable). Quitar un
 * campo del override = pasar undefined: la zona vuelve a heredar lo global en él.
 * Si la zona queda sin estilo ni objetivo, se elimina su entrada (no deja ruido).
 */
export function setZoneOverride(
  collected: Collected,
  zoneId: string,
  override: { estilo?: Estilo; objetivo?: string },
): Collected {
  const next = { ...(collected.zoneOverrides ?? {}) };
  const clean: { estilo?: Estilo; objetivo?: string } = {};
  if (override.estilo !== undefined) clean.estilo = override.estilo;
  if (override.objetivo !== undefined && override.objetivo !== '') clean.objetivo = override.objetivo;

  if (clean.estilo === undefined && clean.objetivo === undefined) {
    delete next[zoneId];
  } else {
    next[zoneId] = clean;
  }

  // Si no queda ningún override, se omite la clave para no ensuciar el Json.
  if (Object.keys(next).length === 0) {
    const rest = { ...collected };
    delete rest.zoneOverrides;
    return rest;
  }
  return { ...collected, zoneOverrides: next };
}
