import type { EditorDocument, Ramp } from './schema';
import { isRampLanding } from './ramp-kind';
import { rampArrival } from './ramp-arrival';
import { stairArrival } from './stair-arrival';
import { placeLandingAtArrival, type LandingArrival } from './ramp-landing-placement';

const PARALLEL_COSINE = .99, COLLINEAR_MM = 120, ADJACENT_GAP_MM = 300;

/** Llegadas de rampas y escaleras a las que un descansillo puede rematar. */
export function landingArrivals(doc: EditorDocument, landing: Ramp): LandingArrival[] {
  return [
    ...(doc.ramps ?? []).filter((ramp) => ramp.id !== landing.id && !isRampLanding(ramp)).map((ramp) => ({ ...rampArrival(ramp), widthMm: ramp.widthMm })),
    ...(doc.stairs ?? []).map((stair) => stairArrival(stair)),
  ];
}

/**
 * Una rampa y una escalera que llegan juntas, paralelas y a ras, forman una sola llegada más ancha: el descansillo
 * las remata a las dos en vez de adaptarse solo a la más cercana.
 */
export function mergeAdjacentArrivals(arrivals: LandingArrival[]): LandingArrival[] {
  const merged: LandingArrival[] = [];
  const remaining = [...arrivals];
  while (remaining.length) {
    let group = remaining.shift()!;
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const other = remaining[i]!;
        if (!adjacent(group, other)) continue;
        group = union(group, other); remaining.splice(i, 1); changed = true; break;
      }
    }
    merged.push(group);
  }
  return merged;
}

function adjacent(a: LandingArrival, b: LandingArrival): boolean {
  if (a.direction.x * b.direction.x + a.direction.y * b.direction.y < PARALLEL_COSINE) return false;
  if (Math.abs(a.elevationMm - b.elevationMm) > 1) return false;
  const along = { x: -a.direction.y, y: a.direction.x };
  const dx = b.point.x - a.point.x, dy = b.point.y - a.point.y;
  const forward = dx * a.direction.x + dy * a.direction.y, lateral = dx * along.x + dy * along.y;
  return Math.abs(forward) <= COLLINEAR_MM && Math.abs(lateral) - (a.widthMm + b.widthMm) / 2 <= ADJACENT_GAP_MM;
}

function union(a: LandingArrival, b: LandingArrival): LandingArrival {
  const along = { x: -a.direction.y, y: a.direction.x };
  const offset = (b.point.x - a.point.x) * along.x + (b.point.y - a.point.y) * along.y;
  const min = Math.min(-a.widthMm / 2, offset - b.widthMm / 2), max = Math.max(a.widthMm / 2, offset + b.widthMm / 2);
  const centre = (min + max) / 2;
  return { direction: a.direction, elevationMm: Math.max(a.elevationMm, b.elevationMm), widthMm: max - min,
    point: { x: a.point.x + along.x * centre, y: a.point.y + along.y * centre } };
}

/** Coloca el descansillo contra la llegada (simple o combinada) más cercana dentro de `maxGapMm`; null si no hay ninguna. */
export function placeLandingAtHosts(doc: EditorDocument, landing: Ramp, maxGapMm: number, gapOf: (placed: Ramp) => number): Ramp | null {
  const candidates = mergeAdjacentArrivals(landingArrivals(doc, landing)).map((arrival) => placeLandingAtArrival(landing, arrival))
    .map((placed) => ({ placed, gap: gapOf(placed) })).filter((candidate) => candidate.gap <= maxGapMm).sort((a, b) => a.gap - b.gap);
  return candidates[0]?.placed ?? null;
}
