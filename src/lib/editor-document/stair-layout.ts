import type { Point, Stair } from './schema';

/** Local plan x/y from top-left; z is vertical bottom. Rotation/translation are external. */
export interface StairBox {
  x: number; y: number; z: number;
  widthMm: number; depthMm: number; heightMm: number;
}
export interface StairLayout { steps: StairBox[]; landings: StairBox[]; outline: Point[] }

/** Shared solid tread layout: all units mm, elevation is added only by the scene projector. */
export function stairLayout(stair: Stair): StairLayout {
  const { widthMm: w, depthMm: d, heightMm: h, stepCount: n } = stair;
  if (![w, d, h].every((v) => Number.isFinite(v) && v > 0) || !Number.isInteger(n) || n < 3 || n > 128)
    throw new Error('Dimensiones de escalera inválidas');
  const steps: StairBox[] = [];
  const landings: StairBox[] = [];
  const rise = h / n;
  const box = (x: number, y: number, widthMm: number, depthMm: number, level: number): StairBox =>
    ({ x, y, z: 0, widthMm, depthMm, heightMm: level * rise });
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
  if (stair.kind === 'straight') {
    for (let i = 0; i < n; i++) steps.push(box(0, d - (i + 1) * d / n, w, d / n, i + 1));
  } else {
    const flight = stair.kind === 'U' ? w / 2 : Math.min(w, d) / 3;
    if (d <= flight || w <= flight) throw new Error('Espacio insuficiente para descansillo');
    const first = Math.floor((n - 1) / 2);
    const second = n - first - 1;
    const run = d - flight;
    for (let i = 0; i < first; i++)
      steps.push(box(0, d - (i + 1) * run / first, flight, run / first, i + 1));
    if (stair.kind === 'U') {
      landings.push(box(0, 0, w, flight, first + 1));
      for (let i = 0; i < second; i++)
        steps.push(box(flight, flight + i * run / second, flight, run / second, first + i + 2));
    } else if (stair.kind === 'L') {
      landings.push(box(0, 0, flight, flight, first + 1));
      for (let i = 0; i < second; i++)
        steps.push(box(flight + i * (w - flight) / second, 0, (w - flight) / second, flight, first + i + 2));
      outline.splice(2, 0, { x: w, y: flight }, { x: flight, y: flight }, { x: flight, y: d });
      outline.splice(5, 1);
    } else throw new Error('Escalera desconocida');
  }
  return { steps, landings, outline };
}
