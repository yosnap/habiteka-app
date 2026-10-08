/**
 * Normaliza la zona seleccionada en la UI a una región acotada y válida.
 *
 * La UI envía una `CanvasZone` (bbox 0–1 o polígono); aquí se reduce a una caja
 * normalizada y se valida que cae dentro del lienzo. Una zona fuera de rango o
 * degenerada se rechaza antes de construir la máscara o tocar al proveedor.
 */
import type { CanvasZone, NormalizedBBox } from '@/lib/contracts';
import { UserFacingError } from '@/server/errors/user-facing-error';

export class InvalidZoneError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidZoneError';
  }
}

/** Reduce una zona (bbox o polígono) a una caja normalizada 0–1 validada. */
export function resolveZone(zone: CanvasZone): NormalizedBBox {
  if (!zone || typeof zone !== 'object' || typeof zone.id !== 'string' || !zone.id.trim())
    throw new InvalidZoneError('Selecciona una zona de la imagen.');
  if (zone.maskRef) throw new InvalidZoneError('Vuelve a seleccionar la zona: no se admiten máscaras externas.');
  if (zone.bbox && zone.polygon) throw new InvalidZoneError('Selecciona un rectángulo o un polígono, no ambos.');
  const box = zone.bbox ?? polygonToBBox(zone.polygon);
  if (!box) {
    throw new InvalidZoneError('La zona no define ni bbox ni polígono');
  }
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite))
    throw new InvalidZoneError('Las coordenadas de la zona no son válidas.');
  if (box.width <= 0 || box.height <= 0) {
    throw new InvalidZoneError('La zona tiene área nula');
  }
  if (box.x < 0 || box.y < 0 || box.x + box.width > 1 || box.y + box.height > 1) {
    throw new InvalidZoneError('La zona excede los límites del lienzo');
  }
  return box;
}

function polygonToBBox(points: CanvasZone['polygon']): NormalizedBBox | null {
  if (!Array.isArray(points) || points.length < 3 || points.length > 128) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw new InvalidZoneError('Los puntos de la zona no son válidos.');
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const area = Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]!;
    return sum + p.x * next.y - next.x * p.y;
  }, 0));
  if (area < 1e-10) throw new InvalidZoneError('La zona tiene área nula.');
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Solo el rectángulo completo autoriza modificar toda la imagen. */
export function isWholeImageZone(zone: CanvasZone): boolean {
  const b = zone.bbox;
  return !zone.polygon && !!b && b.x === 0 && b.y === 0 && b.width === 1 && b.height === 1;
}
