import type { CanvasZone } from '@/lib/contracts';
import { resolveZone } from '@/server/agent/feedback/zone-resolver';

export interface InpaintWindow { left: number; top: number; width: number; height: number }

/** Contexto cercano para que un detalle pequeño no se pierda en una planta completa. */
export function inpaintWindow(zone: CanvasZone, width: number, height: number): InpaintWindow {
  const box = resolveZone(zone);
  const left = Math.floor(box.x * width), top = Math.floor(box.y * height);
  const right = Math.ceil((box.x + box.width) * width), bottom = Math.ceil((box.y + box.height) * height);
  // Cuadrado: proporción compatible con todos los proveedores actuales. El margen
  // aporta paredes/suelo adyacentes, pero NO amplía la máscara editable.
  const side = Math.max(512, Math.ceil(Math.max(right - left, bottom - top) * 3 / 16) * 16);
  if (side > Math.min(width, height) || side * side >= width * height * .65)
    return { left: 0, top: 0, width, height };
  return {
    left: Math.max(0, Math.min(width - side, Math.floor((left + right - side) / 2))),
    top: Math.max(0, Math.min(height - side, Math.floor((top + bottom - side) / 2))),
    width: side, height: side,
  };
}

/** Misma geometría, expresada sobre el recorte que recibe el proveedor. */
export function zoneInWindow(zone: CanvasZone, window: InpaintWindow, width: number, height: number): CanvasZone {
  const point = ({ x, y }: { x: number; y: number }) => ({
    x: (x * width - window.left) / window.width,
    y: (y * height - window.top) / window.height,
  });
  if (zone.polygon) return { id: zone.id, polygon: zone.polygon.map(point) };
  const box = resolveZone(zone);
  return { id: zone.id, bbox: { ...point(box), width: box.width * width / window.width, height: box.height * height / window.height } };
}
