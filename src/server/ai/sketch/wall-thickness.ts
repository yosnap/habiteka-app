/**
 * Grosor de muro por CLASES a partir de la medición de píxeles.
 *
 * Un plano dibujado distingue la fachada (poché grueso) de los tabiques
 * (línea fina). La limpieza topológica (`wall-cleanup`) crea segmentos nuevos y
 * pierde el grosor medido, así que aquí se REASIGNA al final por solape con las
 * bandas originales y se agrupa en como mucho dos clases (exterior/interior)
 * con un k-means 1D determinista. Puro y sin IA.
 */
import type { SketchWall } from './sketch-types';

interface Vec {
  x: number;
  y: number;
}

function unitDir(w: SketchWall): Vec | null {
  const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  if (len < 1e-9) return null;
  return { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len };
}

function isParallel(a: Vec, b: Vec, tolDeg: number): boolean {
  return Math.abs(a.x * b.y - a.y * b.x) <= Math.sin((tolDeg * Math.PI) / 180);
}

/**
 * Devuelve cada muro limpio con el grosor de las bandas medidas que solapan
 * con él (mediana ponderada por longitud de solape). Sin banda que solape, el
 * muro queda sin grosor (el llamador aplica el valor por defecto).
 */
export function assignMeasuredThickness(
  walls: SketchWall[],
  measured: SketchWall[],
  maxPerp: number,
  tolDeg: number,
): SketchWall[] {
  const bands = measured.filter((m) => m.thickness !== undefined && unitDir(m) !== null);
  return walls.map((wall) => {
    const dir = unitDir(wall);
    if (!dir) return wall;
    const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    const normal = { x: -dir.y, y: dir.x };
    const along = (x: number, y: number) => (x - wall.x1) * dir.x + (y - wall.y1) * dir.y;
    const across = (x: number, y: number) => (x - wall.x1) * normal.x + (y - wall.y1) * normal.y;

    const samples: Array<{ thickness: number; weight: number }> = [];
    for (const band of bands) {
      const bandDir = unitDir(band)!;
      if (!isParallel(dir, bandDir, tolDeg)) continue;
      const mid = across((band.x1 + band.x2) / 2, (band.y1 + band.y2) / 2);
      if (Math.abs(mid) > maxPerp) continue;
      const [t1, t2] = [along(band.x1, band.y1), along(band.x2, band.y2)].sort((a, b) => a - b) as [
        number,
        number,
      ];
      const overlap = Math.min(len, t2) - Math.max(0, t1);
      if (overlap <= 0) continue;
      samples.push({ thickness: band.thickness!, weight: overlap });
    }
    const thickness = weightedMedian(samples);
    return thickness === undefined ? wall : { ...wall, thickness };
  });
}

function weightedMedian(samples: Array<{ thickness: number; weight: number }>): number | undefined {
  if (samples.length === 0) return undefined;
  const sorted = [...samples].sort((a, b) => a.thickness - b.thickness);
  const total = sorted.reduce((acc, s) => acc + s.weight, 0);
  let acc = 0;
  for (const s of sorted) {
    acc += s.weight;
    if (acc >= total / 2) return s.thickness;
  }
  return sorted[sorted.length - 1]!.thickness;
}

// Grosores plausibles de un muro en planta (mm): por debajo es una línea de
// dibujo, por encima una mancha.
const MIN_WALL_MM = 80;
const MAX_WALL_MM = 400;
// Dos clases solo si la gruesa es claramente mayor: menos es ruido de trazo.
const MIN_CLASS_RATIO = 1.5;
const KMEANS_ITERATIONS = 12;

/**
 * Agrupa grosores (mm) en una o dos clases y devuelve el grosor final de cada
 * muro. Con una sola clase creíble, todos reciben `fallbackMm` (la medida de
 * un trazo uniforme no informa del grosor real). Un muro sin medida recibe la
 * clase fina (los tabiques son lo más frecuente).
 */
export function classifyWallThickness(
  thicknessesMm: Array<number | undefined>,
  fallbackMm: number,
): number[] {
  const known = thicknessesMm.filter((t): t is number => t !== undefined && Number.isFinite(t));
  if (known.length < 2) return thicknessesMm.map(() => fallbackMm);

  let thin = Math.min(...known);
  let thick = Math.max(...known);
  let members: boolean[] = [];
  for (let i = 0; i < KMEANS_ITERATIONS; i++) {
    members = known.map((t) => Math.abs(t - thick) < Math.abs(t - thin));
    const thickGroup = known.filter((_, j) => members[j]);
    const thinGroup = known.filter((_, j) => !members[j]);
    if (thickGroup.length === 0 || thinGroup.length === 0) break;
    const nextThick = mean(thickGroup);
    const nextThin = mean(thinGroup);
    if (nextThick === thick && nextThin === thin) break;
    thick = nextThick;
    thin = nextThin;
  }
  const thickCount = members.filter(Boolean).length;
  const twoClasses =
    thickCount >= 2 && known.length - thickCount >= 2 && thick / Math.max(thin, 1) >= MIN_CLASS_RATIO;
  if (!twoClasses) return thicknessesMm.map(() => fallbackMm);

  const thinMm = roundMm(thin);
  const thickMm = roundMm(thick);
  return thicknessesMm.map((t) => {
    if (t === undefined || !Number.isFinite(t)) return thinMm;
    return Math.abs(t - thick) < Math.abs(t - thin) ? thickMm : thinMm;
  });
}

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function roundMm(value: number): number {
  return Math.min(MAX_WALL_MM, Math.max(MIN_WALL_MM, Math.round(value / 10) * 10));
}
