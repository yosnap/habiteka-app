/**
 * Planarización del `Plano2dPayload`: parte cada muro en sus cruces y uniones
 * en T con otros muros y funde los tramos colineales duplicados, remapeando
 * las aberturas al tramo que contiene su centro. Necesario porque la
 * conversión al editor valida la topología al construir el documento y un
 * plano importado (tabiques reconstruidos) trae muros que se atraviesan.
 * Misma geometría que `planarize-walls` del editor. Puro.
 */
import type { PlanAperture, PlanPoint, PlanWall, PlanZone, Plano2dPayload } from '@/lib/contracts';
import { EPS_MM, segmentIntersections, T_EPS } from '@/lib/editor-document/adapters/planarize-walls';

export function planarizePlano(plano: Plano2dPayload): Plano2dPayload {
  const ownerZone = new Map<string, number>();
  const originals: PlanWall[] = [];
  plano.zones.forEach((zone, zi) => {
    for (const w of zone.walls) {
      if (ownerZone.has(w.id)) continue;
      ownerZone.set(w.id, zi);
      originals.push(w);
    }
  });
  const segments = originals.map((w) => ({ a: w.from, b: w.to }));
  const cuts = originals.map(() => new Set<number>());
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      for (const [ti, tj] of segmentIntersections(segments[i]!, segments[j]!)) {
        if (ti > T_EPS && ti < 1 - T_EPS) cuts[i]!.add(ti);
        if (tj > T_EPS && tj < 1 - T_EPS) cuts[j]!.add(tj);
      }
    }
  }

  const pieces = new Map<string, PlanWall>(); // clave: extremos ordenados
  const piecesByZone = new Map<number, PlanWall[]>();
  const ranges = new Map<string, Array<{ id: string; t0: number; t1: number }>>();
  originals.forEach((wall, i) => {
    const ts = [0, ...[...cuts[i]!].sort((x, y) => x - y), 1];
    const list: Array<{ id: string; t0: number; t1: number }> = [];
    for (let k = 0; k < ts.length - 1; k++) {
      const t0 = ts[k]!;
      const t1 = ts[k + 1]!;
      if (t1 - t0 <= T_EPS) continue;
      const from = lerp(wall.from, wall.to, t0);
      const to = lerp(wall.from, wall.to, t1);
      if (Math.hypot(to.x - from.x, to.y - from.y) < EPS_MM) continue;
      const key = [pointKey(from), pointKey(to)].sort().join('|');
      const existing = pieces.get(key);
      if (existing) {
        if (wall.thicknessMm > existing.thicknessMm) existing.thicknessMm = wall.thicknessMm;
        list.push({ id: existing.id, t0, t1 });
        continue;
      }
      const id = k === 0 ? wall.id : `${wall.id}:${k + 1}`;
      const piece: PlanWall = { id, from, to, thicknessMm: wall.thicknessMm };
      pieces.set(key, piece);
      const zi = ownerZone.get(wall.id)!;
      piecesByZone.set(zi, [...(piecesByZone.get(zi) ?? []), piece]);
      list.push({ id, t0, t1 });
    }
    ranges.set(wall.id, list);
  });

  const zones: PlanZone[] = plano.zones.map((zone, zi) => {
    const apertures: PlanAperture[] = [];
    for (const ap of zone.apertures) {
      const wall = originals.find((w) => w.id === ap.wallId);
      const list = ranges.get(ap.wallId);
      if (!wall || !list) continue;
      const range = list.find((r) => ap.position >= r.t0 - T_EPS && ap.position <= r.t1 + T_EPS);
      if (!range) continue;
      const originalLength = Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y);
      const pieceLength = originalLength * (range.t1 - range.t0);
      if (ap.widthMm >= pieceLength) continue;
      apertures.push({ ...ap, wallId: range.id, position: (ap.position - range.t0) / (range.t1 - range.t0) });
    }
    return { ...zone, walls: piecesByZone.get(zi) ?? [], apertures };
  });
  return { ...plano, zones };
}

function lerp(a: PlanPoint, b: PlanPoint, t: number): PlanPoint {
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
}

function pointKey(p: PlanPoint): string {
  return `${p.x},${p.y}`;
}
