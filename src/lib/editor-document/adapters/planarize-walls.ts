/**
 * Planarización de muros: el editor exige que dos muros que se cruzan o se
 * tocan en T compartan un vértice. Un plano importado trae muros que se
 * atraviesan (tabiques reconstruidos, límites ocultos de terrazas) sin ese
 * vértice, así que aquí se parte cada muro en cada intersección y se funden
 * los tramos colineales duplicados. Los huecos se reasignan al tramo que
 * contiene su centro. Puro y cliente-safe.
 */
import type { EditorDocument, Opening, Point, Wall } from '../schema';
import { vertexId } from './shared';

export const EPS_MM = 0.5;
export const T_EPS = 1e-6;

export function planarizeWalls(input: EditorDocument): EditorDocument {
  const doc = input;
  const vertex = (id: string): Point => {
    const v = doc.vertices.find((x) => x.id === id);
    if (!v) throw new Error(`Vértice ${id} inexistente`);
    return v;
  };
  const segments = doc.walls.map((wall) => ({ wall, a: vertex(wall.startVertexId), b: vertex(wall.endVertexId) }));

  // Parámetros de corte por muro (0–1 a lo largo del segmento).
  const cuts = segments.map(() => new Set<number>());
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const hit = segmentIntersections(segments[i]!, segments[j]!);
      for (const [ti, tj] of hit) {
        if (ti > T_EPS && ti < 1 - T_EPS) cuts[i]!.add(ti);
        if (tj > T_EPS && tj < 1 - T_EPS) cuts[j]!.add(tj);
      }
    }
  }

  const pieces: Wall[] = [];
  const pieceRanges = new Map<string, Array<{ id: string; t0: number; t1: number }>>();
  const seen = new Map<string, Wall>();
  // Ids únicos en todo el documento: el plano puede traer ya sufijos de otra
  // planarización (`w3:2`), así que aquí se usa otro separador y se verifica.
  const takenIds = new Set<string>([
    ...doc.walls, ...doc.openings, ...doc.furniture, ...doc.labels, ...doc.dimensions, ...doc.vertices,
  ].map((e) => e.id));
  const uniqueId = (base: string): string => {
    let candidate = base;
    let n = 2;
    while (takenIds.has(candidate)) candidate = `${base}~${n++}`;
    takenIds.add(candidate);
    return candidate;
  };
  segments.forEach(({ wall, a, b }, i) => {
    const ts = [0, ...[...cuts[i]!].sort((x, y) => x - y), 1];
    const ranges: Array<{ id: string; t0: number; t1: number }> = [];
    for (let k = 0; k < ts.length - 1; k++) {
      const t0 = ts[k]!;
      const t1 = ts[k + 1]!;
      if (t1 - t0 <= T_EPS) continue;
      const p0 = lerp(a, b, t0);
      const p1 = lerp(a, b, t1);
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < EPS_MM) continue;
      const start = vertexId(doc, round(p0));
      const end = vertexId(doc, round(p1));
      if (start === end) continue;
      // Dos muros colineales que solapan producen el mismo tramo: se conserva uno (el visible).
      const key = [start, end].sort().join('|');
      const existing = seen.get(key);
      if (existing) {
        if (existing.hidden && !wall.hidden) Object.assign(existing, { hidden: undefined, thicknessMm: wall.thicknessMm });
        ranges.push({ id: existing.id, t0, t1 });
        continue;
      }
      const id = k === 0 ? wall.id : uniqueId(`${wall.id}~${k + 1}`);
      const piece: Wall = { ...wall, id, startVertexId: start, endVertexId: end };
      if (piece.hidden === undefined) delete piece.hidden;
      pieces.push(piece);
      seen.set(key, piece);
      ranges.push({ id, t0, t1 });
    }
    pieceRanges.set(wall.id, ranges);
  });

  const openings: Opening[] = [];
  for (const opening of doc.openings) {
    const ranges = pieceRanges.get(opening.wallId);
    const original = segments.find((s) => s.wall.id === opening.wallId);
    if (!ranges || !original) continue;
    const range = ranges.find((r) => opening.position >= r.t0 - T_EPS && opening.position <= r.t1 + T_EPS);
    if (!range) continue;
    const originalLength = Math.hypot(original.b.x - original.a.x, original.b.y - original.a.y);
    const pieceLength = originalLength * (range.t1 - range.t0);
    if (opening.widthMm >= pieceLength) continue; // No cabe en el tramo: mejor sin hueco que inválido.
    const halfRatio = opening.widthMm / pieceLength / 2;
    const position = Math.min(Math.max((opening.position - range.t0) / (range.t1 - range.t0), halfRatio), 1 - halfRatio);
    openings.push({ ...opening, wallId: range.id, position });
  }

  doc.walls = pieces;
  doc.openings = openings;
  // Vértices huérfanos tras fundir tramos: fuera.
  const used = new Set(pieces.flatMap((w) => [w.startVertexId, w.endVertexId]));
  doc.vertices = doc.vertices.filter((v) => used.has(v.id));
  return doc;
}

export interface Segment {
  a: Point;
  b: Point;
}

/** Parámetros (t sobre s1, u sobre s2) de cada punto donde los segmentos se tocan. */
export function segmentIntersections(s1: Segment, s2: Segment): Array<[number, number]> {
  const d1 = { x: s1.b.x - s1.a.x, y: s1.b.y - s1.a.y };
  const d2 = { x: s2.b.x - s2.a.x, y: s2.b.y - s2.a.y };
  const denom = d1.x * d2.y - d1.y * d2.x;
  const w = { x: s2.a.x - s1.a.x, y: s2.a.y - s1.a.y };
  if (Math.abs(denom) > 1e-9) {
    const t = (w.x * d2.y - w.y * d2.x) / denom;
    const u = (w.x * d1.y - w.y * d1.x) / denom;
    const tol1 = EPS_MM / Math.hypot(d1.x, d1.y);
    const tol2 = EPS_MM / Math.hypot(d2.x, d2.y);
    if (t < -tol1 || t > 1 + tol1 || u < -tol2 || u > 1 + tol2) return [];
    return [[clamp01(t), clamp01(u)]];
  }
  // Paralelos: solo interesan los colineales que solapan (se cortan en los extremos del otro).
  const cross = w.x * d1.y - w.y * d1.x;
  const len1 = Math.hypot(d1.x, d1.y);
  if (len1 === 0 || Math.abs(cross) / len1 > EPS_MM) return [];
  const proj = (p: Point) => ((p.x - s1.a.x) * d1.x + (p.y - s1.a.y) * d1.y) / (len1 * len1);
  const out: Array<[number, number]> = [];
  const len2 = Math.hypot(d2.x, d2.y);
  const proj2 = (p: Point) => ((p.x - s2.a.x) * d2.x + (p.y - s2.a.y) * d2.y) / (len2 * len2);
  for (const p of [s2.a, s2.b]) {
    const t = proj(p);
    if (t > T_EPS && t < 1 - T_EPS) out.push([t, clamp01(proj2(p))]);
  }
  for (const p of [s1.a, s1.b]) {
    const u = proj2(p);
    if (u > T_EPS && u < 1 - T_EPS) out.push([clamp01(proj(p)), u]);
  }
  return out;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function round(p: Point): Point {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
