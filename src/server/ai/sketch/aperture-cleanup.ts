/**
 * Saneado de ABERTURAS tras mover muros: al ajustar el plano a las cotas un
 * muro puede acortarse y dos huecos que cabían pasan a pisarse, o uno queda
 * asomando por el extremo. El editor rechaza ambos casos, así que aquí se
 * recolocan dentro del muro y, si aun así se solapan, se conserva el más ancho
 * (una puerta antes que un hueco dudoso). Puro y determinista.
 */
import type { PlanAperture, PlanWall, Plano2dPayload } from '@/lib/contracts';

// Separación mínima entre dos aberturas del mismo muro (mm).
const MIN_GAP_MM = 50;
// La lectura de símbolos pequeños puede desplazar la unión puerta/ventana
// algunos píxeles. Solo se corrige una discrepancia de esta magnitud.
const MAX_WINDOW_NUDGE_MM = 150;

export function cleanupApertures(plano: Plano2dPayload): Plano2dPayload {
  const wallsById = new Map<string, PlanWall>();
  for (const zone of plano.zones) for (const w of zone.walls) wallsById.set(w.id, w);

  // Todas las aberturas del plano agrupadas por muro (una zona posee cada abertura).
  const byWall = new Map<string, Array<{ zoneIndex: number; aperture: PlanAperture }>>();
  plano.zones.forEach((zone, zoneIndex) => {
    for (const aperture of zone.apertures) {
      const list = byWall.get(aperture.wallId) ?? [];
      list.push({ zoneIndex, aperture });
      byWall.set(aperture.wallId, list);
    }
  });

  const kept = new Map<number, PlanAperture[]>();
  for (const [wallId, entries] of byWall) {
    const wall = wallsById.get(wallId);
    if (!wall) continue;
    const length = Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y);
    if (length <= 0) continue;
    // Una puerta con arco reconocido manda sobre una ventana que invade su
    // jambaje por unos píxeles; entre aberturas del mismo tipo manda el ancho.
    const candidates = entries
      .map(({ zoneIndex, aperture }) => ({ zoneIndex, aperture: fitInsideWall(aperture, length) }))
      .filter((e): e is { zoneIndex: number; aperture: PlanAperture } => e.aperture !== null)
      .sort((a, b) => Number(b.aperture.kind === 'puerta') - Number(a.aperture.kind === 'puerta') ||
        b.aperture.widthMm - a.aperture.widthMm);
    const placed: PlanAperture[] = [];
    for (const { zoneIndex, aperture: candidate } of candidates) {
      const aperture = candidate.kind === 'ventana'
        ? nudgeWindowAfterDoor(candidate, placed, length) : candidate;
      const [lo, hi] = extent(aperture, length);
      const overlaps = placed.some((p) => overlapsWithGap([lo, hi], extent(p, length)));
      if (overlaps) continue;
      placed.push(aperture);
      kept.set(zoneIndex, [...(kept.get(zoneIndex) ?? []), aperture]);
    }
  }

  return {
    ...plano,
    zones: plano.zones.map((zone, i) => ({
      ...zone,
      apertures: (kept.get(i) ?? []).sort((a, b) => a.position - b.position),
    })),
  };
}

function overlapsWithGap([lo, hi]: [number, number], [otherLo, otherHi]: [number, number]): boolean {
  return lo < otherHi + MIN_GAP_MM && hi > otherLo - MIN_GAP_MM;
}

function nudgeWindowAfterDoor(window: PlanAperture, placed: PlanAperture[], length: number): PlanAperture {
  const door = placed.find((item) => item.kind === 'puerta' &&
    overlapsWithGap(extent(window, length), extent(item, length)));
  if (!door) return window;
  const center = window.position * length;
  const [doorLo, doorHi] = extent(door, length);
  const half = window.widthMm / 2;
  const target = center >= (doorLo + doorHi) / 2
    ? doorHi + MIN_GAP_MM + half : doorLo - MIN_GAP_MM - half;
  if (target < half || target > length - half || Math.abs(target - center) > MAX_WINDOW_NUDGE_MM) return window;
  const moved = { ...window, position: target / length };
  return placed.some((item) => overlapsWithGap(extent(moved, length), extent(item, length))) ? window : moved;
}

/** Recentra la abertura para que quepa entera en el muro; null si el muro es más corto que ella. */
function fitInsideWall(aperture: PlanAperture, lengthMm: number): PlanAperture | null {
  if (aperture.widthMm >= lengthMm) return null;
  const halfRatio = aperture.widthMm / lengthMm / 2;
  const position = Math.min(Math.max(aperture.position, halfRatio), 1 - halfRatio);
  return position === aperture.position ? aperture : { ...aperture, position };
}

function extent(aperture: PlanAperture, lengthMm: number): [number, number] {
  const center = aperture.position * lengthMm;
  return [center - aperture.widthMm / 2, center + aperture.widthMm / 2];
}
