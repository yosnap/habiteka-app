import type { RawSketch } from './sketch-types';
import type { Scale } from './normalize-geometry';

/** Escala isotrópica a partir de cotas generales y proporción medida de la imagen. */
export function reliableScale(
  raw: RawSketch,
  spanX: number,
  spanY: number,
  aspect: number | undefined,
): Scale | null {
  const fromWidth = raw.anchoMetros !== undefined && spanX > 0 ? (raw.anchoMetros * 1000) / spanX : undefined;
  const fromHeight = raw.altoMetros !== undefined && spanY > 0 ? (raw.altoMetros * 1000) / spanY : undefined;
  if (aspect === undefined || !(aspect > 0)) {
    if (fromWidth === undefined && fromHeight === undefined) return null;
    const mmX = fromWidth ?? fromHeight!;
    return { mmPerUnitX: mmX, mmPerUnitY: fromHeight ?? mmX };
  }
  // Una cota vertical puede abarcar una terraza o entrada fuera del perímetro
  // interior. Se elige la candidata más cercana a las cotas por estancia.
  const candidates = [fromWidth, fromHeight !== undefined ? fromHeight / aspect : undefined]
    .filter((c): c is number => c !== undefined && c > 0);
  if (candidates.length === 0) return null;
  const implied = scaleImpliedByRooms(raw, aspect);
  const mmX = implied === undefined ? candidates[0]!
    : candidates.reduce((best, c) => (Math.abs(c - implied) < Math.abs(best - implied) ? c : best));
  return { mmPerUnitX: mmX, mmPerUnitY: mmX * aspect };
}

/** Mediana de la escala implícita en las cotas de las estancias. */
function scaleImpliedByRooms(raw: RawSketch, aspect: number): number | undefined {
  const ratios: number[] = [];
  for (const room of raw.habitaciones) {
    if (room.poligono.length < 3) continue;
    const xs = room.poligono.map((p) => p.x);
    const ys = room.poligono.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = (Math.max(...ys) - Math.min(...ys)) * aspect;
    if (room.anchoMetros !== undefined && w > 0.01) ratios.push((room.anchoMetros * 1000) / w);
    if (room.altoMetros !== undefined && h > 0.01) ratios.push((room.altoMetros * 1000) / h);
  }
  if (ratios.length === 0) return undefined;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}
