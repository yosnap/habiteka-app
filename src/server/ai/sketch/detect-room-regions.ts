/**
 * Detección de HABITACIONES desde los muros medidos: las estancias son los
 * espacios cerrados entre muros, y eso se encuentra con un flood fill sobre
 * una rejilla de ocupación — determinista y sin depender de que el grafo de
 * muros forme ciclos perfectos. Los muros deben llegar YA PUENTEADOS (los
 * vanos de puerta sellados), o cada puerta "fugaría" la habitación al pasillo.
 *
 * Espacio de trabajo: unidades de imagen 0–1 (como el resto del pipeline).
 */
import type { SketchPoint, SketchWall } from './sketch-types';

const GRID = 220;
// Una región más pequeña que esto (fracción del área de la rejilla) es un
// resquicio entre muros, no una habitación.
const MIN_REGION_RATIO = 0.004;

export interface RoomRegion {
  /** Caja envolvente de la región, en unidades de imagen. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Centro de masa de la región (para colocar etiquetas). */
  centroid: SketchPoint;
  /** Área de la región en unidades² de imagen. */
  area: number;
}

/**
 * Encuentra las regiones cerradas (habitaciones) delimitadas por los muros.
 * `halfThickness` es el medio grosor del muro en unidades de imagen: engorda
 * los segmentos para que la rejilla no deje rendijas por las que fugar.
 */
export function detectRoomRegions(walls: SketchWall[], halfThickness: number): RoomRegion[] {
  if (walls.length === 0) return [];

  // Marco de trabajo: bbox de los muros con margen; el borde queda "fuera".
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const ys = walls.flatMap((w) => [w.y1, w.y2]);
  const margin = halfThickness * 4 + 1e-6;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX <= 0 || spanY <= 0) return [];

  const toCellX = (x: number) => Math.floor(((x - minX) / spanX) * GRID);
  const toCellY = (y: number) => Math.floor(((y - minY) / spanY) * GRID);
  const clampCell = (c: number) => Math.min(Math.max(c, 0), GRID - 1);

  // 1. Rejilla de ocupación: cada muro pinta su rectángulo engordado.
  const occupied = new Uint8Array(GRID * GRID);
  const cellStep = Math.min(spanX, spanY) / GRID / 2;
  for (const w of walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    const steps = Math.max(1, Math.ceil(len / cellStep));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = w.x1 + (w.x2 - w.x1) * t;
      const py = w.y1 + (w.y2 - w.y1) * t;
      const c0x = clampCell(toCellX(px - halfThickness));
      const c1x = clampCell(toCellX(px + halfThickness));
      const c0y = clampCell(toCellY(py - halfThickness));
      const c1y = clampCell(toCellY(py + halfThickness));
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) occupied[cy * GRID + cx] = 1;
      }
    }
  }

  // 2. Marcar el EXTERIOR: flood fill desde los bordes de la rejilla.
  const label = new Int32Array(GRID * GRID); // 0 = sin etiquetar, -1 = exterior, n>0 = región
  const queue: number[] = [];
  for (let c = 0; c < GRID; c++) {
    for (const idx of [c, (GRID - 1) * GRID + c, c * GRID, c * GRID + GRID - 1]) {
      if (!occupied[idx] && label[idx] === 0) {
        label[idx] = -1;
        queue.push(idx);
      }
    }
  }
  floodFrom(queue, occupied, label, -1);

  // 3. Etiquetar las regiones interiores restantes.
  const regions: RoomRegion[] = [];
  let next = 1;
  for (let start = 0; start < GRID * GRID; start++) {
    if (occupied[start] || label[start] !== 0) continue;
    label[start] = next;
    const cells = floodFrom([start], occupied, label, next);
    next++;
    if (cells.length < MIN_REGION_RATIO * GRID * GRID) continue;

    let sumX = 0;
    let sumY = 0;
    let cMinX = GRID;
    let cMaxX = -1;
    let cMinY = GRID;
    let cMaxY = -1;
    for (const idx of cells) {
      const cx = idx % GRID;
      const cy = Math.floor(idx / GRID);
      sumX += cx;
      sumY += cy;
      cMinX = Math.min(cMinX, cx);
      cMaxX = Math.max(cMaxX, cx);
      cMinY = Math.min(cMinY, cy);
      cMaxY = Math.max(cMaxY, cy);
    }
    const toUnitX = (c: number) => minX + ((c + 0.5) / GRID) * spanX;
    const toUnitY = (c: number) => minY + ((c + 0.5) / GRID) * spanY;
    regions.push({
      bbox: {
        minX: toUnitX(cMinX - 0.5),
        maxX: toUnitX(cMaxX + 0.5),
        minY: toUnitY(cMinY - 0.5),
        maxY: toUnitY(cMaxY + 0.5),
      },
      centroid: { x: toUnitX(sumX / cells.length - 0.5), y: toUnitY(sumY / cells.length - 0.5) },
      area: (cells.length / (GRID * GRID)) * spanX * spanY,
    });
  }
  // Orden estable por área descendente (la mayor primero: suele ser el salón).
  return regions.sort((a, b) => b.area - a.area);
}

/** BFS de 4 vecinos sobre celdas libres; devuelve las celdas alcanzadas. */
function floodFrom(
  seed: number[],
  occupied: Uint8Array,
  label: Int32Array,
  mark: number,
): number[] {
  const out: number[] = [...seed];
  const queue = [...seed];
  while (queue.length > 0) {
    const idx = queue.pop()!;
    const cx = idx % GRID;
    const cy = Math.floor(idx / GRID);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      const nIdx = ny * GRID + nx;
      if (occupied[nIdx] || label[nIdx] !== 0) continue;
      label[nIdx] = mark;
      queue.push(nIdx);
      out.push(nIdx);
    }
  }
  return out;
}
