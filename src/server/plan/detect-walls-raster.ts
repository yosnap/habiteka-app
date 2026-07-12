/**
 * Detección CLÁSICA de muros sobre la imagen (sin IA): un plano escaneado son
 * líneas oscuras sobre fondo claro, y eso se localiza con precisión de píxel —
 * el modelo de visión estima coordenadas "a ojo" y desplaza habitaciones
 * enteras (visto en los planos reales). La IA queda para la semántica
 * (nombres, aberturas, escala); la geometría sale de aquí.
 *
 * Algoritmo (ejes ortogonales, v1): binarizar → barrer filas buscando tramos
 * oscuros LARGOS (una pared cruza buena parte de la imagen; un glifo de texto
 * no) → agrupar filas consecutivas con tramos solapados en bandas → cada banda
 * fina y larga es un muro horizontal. Ídem por columnas para los verticales.
 * Los muros diagonales no se detectan (raros en vivienda); si la imagen no es
 * un plano limpio (boceto a lápiz), salen pocas bandas y el llamador hace
 * fallback a los muros del modelo.
 */
import sharp from 'sharp';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';

// Lado máximo del raster de análisis: suficiente resolución, coste acotado.
const MAX_SIDE = 700;
// Gris por debajo del cual un píxel cuenta como "tinta".
const DARK_THRESHOLD = 120;
// Un tramo de pared ocupa al menos este porcentaje del lado de la imagen.
const MIN_RUN_RATIO = 0.05;
// Banda más gruesa que esto no es una pared (mancha, mueble relleno, foto).
const MAX_THICKNESS_RATIO = 0.035;
// Grosor mínimo (px) para descartar líneas capilares (cotas, tramas).
const MIN_THICKNESS_PX = 2;

/** Detecta muros como segmentos normalizados 0–1 (ejes X/Y de la imagen). */
export async function detectWallsFromImage(image: Buffer): Promise<SketchWall[]> {
  const { data, info } = await sharp(image)
    .rotate() // aplica la orientación EXIF antes de medir
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const darkAt = (x: number, y: number) => data[y * w + x]! < DARK_THRESHOLD;

  const walls: SketchWall[] = [];

  // Muros horizontales: barrido de filas (primario = x, secundario = y).
  for (const band of scanBands(w, h, (p, s) => darkAt(p, s))) {
    const y = (band.startLine + band.endLine) / 2 / h;
    walls.push({ x1: band.lo / w, y1: y, x2: band.hi / w, y2: y });
  }
  // Muros verticales: barrido de columnas (primario = y, secundario = x).
  for (const band of scanBands(h, w, (p, s) => darkAt(s, p))) {
    const x = (band.startLine + band.endLine) / 2 / w;
    walls.push({ x1: x, y1: band.lo / h, x2: x, y2: band.hi / h });
  }
  return walls;
}

interface Band {
  /** Extremos del tramo sobre el eje primario (px). */
  lo: number;
  hi: number;
  /** Primera y última línea (eje secundario) que aportaron tramos. */
  startLine: number;
  endLine: number;
}

/**
 * Agrupa tramos oscuros largos de líneas consecutivas en bandas. Una banda
 * fina (grosor de pared) y larga es un muro; lo demás (texto, muebles,
 * manchas) no supera los filtros de longitud/grosor.
 */
function scanBands(
  primary: number,
  secondary: number,
  isDark: (p: number, s: number) => boolean,
): Band[] {
  const minRun = Math.round(primary * MIN_RUN_RATIO);
  const maxThickness = Math.max(MIN_THICKNESS_PX + 1, Math.round(secondary * MAX_THICKNESS_RATIO));
  const active: Array<Band & { lastLine: number }> = [];
  const done: Band[] = [];

  for (let s = 0; s < secondary; s++) {
    // Cerrar bandas que no continuaron en la línea anterior.
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]!.lastLine < s - 1) done.push(...active.splice(i, 1));
    }
    for (const run of findRuns((p) => isDark(p, s), primary, minRun)) {
      const band = active.find((b) => Math.min(run.hi, b.hi) - Math.max(run.lo, b.lo) > 0);
      if (band) {
        band.lo = Math.min(band.lo, run.lo);
        band.hi = Math.max(band.hi, run.hi);
        band.endLine = s;
        band.lastLine = s;
      } else {
        active.push({ ...run, startLine: s, endLine: s, lastLine: s });
      }
    }
  }
  done.push(...active);

  return done.filter((b) => {
    const thickness = b.endLine - b.startLine + 1;
    return thickness >= MIN_THICKNESS_PX && thickness <= maxThickness && b.hi - b.lo >= minRun;
  });
}

/** Tramos continuos de píxeles oscuros de longitud mínima en una línea. */
function findRuns(
  isDark: (p: number) => boolean,
  length: number,
  minRun: number,
): Array<{ lo: number; hi: number }> {
  const runs: Array<{ lo: number; hi: number }> = [];
  let start = -1;
  for (let p = 0; p <= length; p++) {
    const dark = p < length && isDark(p);
    if (dark && start < 0) start = p;
    if (!dark && start >= 0) {
      if (p - start >= minRun) runs.push({ lo: start, hi: p - 1 });
      start = -1;
    }
  }
  return runs;
}
