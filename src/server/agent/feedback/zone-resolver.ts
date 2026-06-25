/**
 * Normaliza la zona seleccionada en la UI a una región acotada y válida.
 *
 * La UI envía una `CanvasZone` (bbox 0–1 o polígono); aquí se reduce a una caja
 * normalizada y se valida que cae dentro del lienzo. Una zona fuera de rango o
 * degenerada se rechaza antes de construir la máscara o tocar al proveedor.
 */
import type { CanvasZone, NormalizedBBox } from '@/lib/contracts';

export class InvalidZoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidZoneError';
  }
}

/** Reduce una zona (bbox o polígono) a una caja normalizada 0–1 validada. */
export function resolveZone(zone: CanvasZone): NormalizedBBox {
  const box = zone.bbox ?? polygonToBBox(zone.polygon);
  if (!box) {
    throw new InvalidZoneError('La zona no define ni bbox ni polígono');
  }
  if (box.width <= 0 || box.height <= 0) {
    throw new InvalidZoneError('La zona tiene área nula');
  }
  if (box.x < 0 || box.y < 0 || box.x + box.width > 1 || box.y + box.height > 1) {
    throw new InvalidZoneError('La zona excede los límites del lienzo');
  }
  return box;
}

function polygonToBBox(points: CanvasZone['polygon']): NormalizedBBox | null {
  if (!points || points.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
