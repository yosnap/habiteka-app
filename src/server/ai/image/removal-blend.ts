/**
 * Al quitar un objeto, el relleno del modelo salía como un rectángulo de otro tono con el borde recto. Se iguala su color
 * al del suelo que rodea la zona y se funde, en una banda junto al borde, con lo que hay justo fuera. El exterior no cambia.
 */
const BAND = 7;
/** Distancia de color (suma de canales) por debajo de la cual un píxel del borde se considera suelo. */
const FLOOR_TONE = 90;

/** `fill` trae el relleno ya en coordenadas de la imagen completa; se modifica solo dentro de la máscara. */
export function blendRemovalFill(original: Buffer, fill: Buffer, mask: Uint8Array, width: number, height: number): void {
  let l = width, t = height, r = -1, b = -1;
  for (let pixel = 0; pixel < mask.length; pixel++) if (mask[pixel] === 255) {
    const x = pixel % width, y = Math.floor(pixel / width);
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  if (r < 0) return;
  const inside: number[] = [], ring: number[] = [];
  for (let y = Math.max(0, t - BAND); y <= Math.min(height - 1, b + BAND); y++)
    for (let x = Math.max(0, l - BAND); x <= Math.min(width - 1, r + BAND); x++) (mask[y * width + x] === 255 ? inside : ring).push(y * width + x);
  // Suelo del borde: lo que se parece al relleno o al tono claro dominante del borde; muros y muebles vecinos no cuentan.
  const tone = median(fill, inside), light = percentileTone(original, ring, .75);
  const floor = ring.filter((pixel) => distance(original, pixel, tone) < FLOOR_TONE || distance(original, pixel, light) < FLOOR_TONE);
  if (floor.length >= 30) {
    const target = stats(original, floor), source = stats(fill, inside.filter((pixel) => distance(fill, pixel, tone) < FLOOR_TONE * 1.5));
    for (const pixel of inside) for (let channel = 0; channel < 3; channel++) {
      const scale = Math.min(1.4, Math.max(.7, target.deviation[channel]! / Math.max(1, source.deviation[channel]!)));
      fill[pixel * 4 + channel] = clamp((fill[pixel * 4 + channel]! - source.mean[channel]!) * scale + target.mean[channel]!);
    }
  }
  // Banda de fundido hacia el color que hay justo fuera de la zona. Mezclar con el original del mismo punto hacía
  // reaparecer, medio transparente, el objeto que llegaba hasta el borde.
  const blended = Buffer.from(fill);
  for (const pixel of inside) {
    const x = pixel % width, y = Math.floor(pixel / width);
    const edge = nearestOutside(mask, width, height, x, y);
    if (!edge) continue;
    const alpha = (edge.step) / (BAND + 1);
    for (let channel = 0; channel < 3; channel++)
      blended[pixel * 4 + channel] = clamp(original[edge.pixel * 4 + channel]! * (1 - alpha) + fill[pixel * 4 + channel]! * alpha);
  }
  for (const pixel of inside) blended.copy(fill, pixel * 4, pixel * 4, pixel * 4 + 3);
}

/** Primer píxel fuera de la zona en las cuatro direcciones, a menos de una banda del punto. */
function nearestOutside(mask: Uint8Array, width: number, height: number, x: number, y: number): { pixel: number; step: number } | null {
  for (let step = 1; step <= BAND; step++)
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (mask[ny * width + nx] !== 255) return { pixel: ny * width + nx, step };
    }
  return null;
}

function distance(data: Buffer, pixel: number, tone: number[]): number {
  return Math.abs(data[pixel * 4]! - tone[0]!) + Math.abs(data[pixel * 4 + 1]! - tone[1]!) + Math.abs(data[pixel * 4 + 2]! - tone[2]!);
}

function percentileTone(data: Buffer, pixels: number[], rank: number): number[] {
  const luma = (pixel: number) => data[pixel * 4]! * .3 + data[pixel * 4 + 1]! * .59 + data[pixel * 4 + 2]! * .11;
  const pixel = [...pixels].sort((a, b) => luma(a) - luma(b))[Math.floor(pixels.length * rank)];
  return pixel === undefined ? [128, 128, 128] : [data[pixel * 4]!, data[pixel * 4 + 1]!, data[pixel * 4 + 2]!];
}

function median(data: Buffer, pixels: number[]): number[] {
  return [0, 1, 2].map((channel) => pixels.map((pixel) => data[pixel * 4 + channel]!).sort((a, b) => a - b)[Math.floor(pixels.length / 2)] ?? 0);
}

function stats(data: Buffer, pixels: number[]): { mean: number[]; deviation: number[] } {
  const mean = [0, 1, 2].map((channel) => pixels.reduce((sum, pixel) => sum + data[pixel * 4 + channel]!, 0) / Math.max(1, pixels.length));
  const deviation = [0, 1, 2].map((channel) => Math.sqrt(pixels.reduce((sum, pixel) => sum + (data[pixel * 4 + channel]! - mean[channel]!) ** 2, 0) / Math.max(1, pixels.length)));
  return { mean, deviation };
}

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
