/**
 * Conversión de una marquesina en píxeles del stage a una zona normalizada.
 *
 * El feedback dirigido necesita la zona en coordenadas 0–1 (contrato `CanvasZone`
 * de F0) para que la misma selección valga ante cualquier resolución de render.
 * Aquí solo vive la matemática, sin Konva, para poder probarla de forma aislada.
 */
import type { CanvasZone } from '@/lib/contracts';

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageSize {
  width: number;
  height: number;
}

/**
 * Normaliza un rectángulo de píxeles a una `CanvasZone` (bbox 0–1). Acota los
 * valores al rango válido y normaliza anchos/altos negativos (marquesina dibujada
 * en cualquier dirección).
 */
export function pixelRectToZone(id: string, rect: PixelRect, stage: StageSize): CanvasZone {
  const x0 = Math.min(rect.x, rect.x + rect.width);
  const y0 = Math.min(rect.y, rect.y + rect.height);
  const w = Math.abs(rect.width);
  const h = Math.abs(rect.height);

  return {
    id,
    bbox: {
      x: clamp01(x0 / stage.width),
      y: clamp01(y0 / stage.height),
      width: clamp01(w / stage.width),
      height: clamp01(h / stage.height),
    },
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
