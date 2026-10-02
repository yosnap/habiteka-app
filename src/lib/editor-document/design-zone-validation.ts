import { polygonSelfIntersects } from './polygon-tools';
import { polygonArea } from './geometry';
import { surfaceMaterial } from './surface-materials';
import type { Point } from './schema';

export const MAX_DESIGN_ZONES = 12;

/** Las zonas son contornos persistentes, no máscaras temporales de una captura. */
export function assertDesignZoneFields(value: unknown, ids: Set<string>): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_DESIGN_ZONES) throw new Error('Zonas de diseño inválidas');
  const names = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Zona de diseño inválida');
    const zone = raw as Record<string, unknown>;
    if (Object.keys(zone).some((key) => !['id', 'name', 'polygon', 'floorFinish'].includes(key)))
      throw new Error('Campo de zona de diseño desconocido');
    if (typeof zone.id !== 'string' || !zone.id.trim() || zone.id.length > 128 || ids.has(zone.id))
      throw new Error('ID de zona de diseño inválido o duplicado');
    ids.add(zone.id);
    if (typeof zone.name !== 'string' || !zone.name.trim() || zone.name.trim().length > 80 || names.has(zone.name.trim()))
      throw new Error('Nombre de zona de diseño inválido o duplicado');
    names.add(zone.name.trim());
    if (!Array.isArray(zone.polygon) || zone.polygon.length < 3 || zone.polygon.length > 20)
      throw new Error('El contorno de diseño necesita de 3 a 20 vértices');
    const polygon = zone.polygon as Point[];
    for (const point of polygon) {
      if (!point || typeof point !== 'object' || Object.keys(point).some((key) => key !== 'x' && key !== 'y') ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e8 || Math.abs(point.y) > 1e8)
        throw new Error('Vértice de zona de diseño inválido');
    }
    if (polygonSelfIntersects(polygon) || Math.abs(polygonArea(polygon)) <= 1)
      throw new Error('Contorno de zona de diseño inválido');
    if (zone.floorFinish === undefined) continue;
    const finish = zone.floorFinish as Record<string, unknown>;
    if (!finish || typeof finish !== 'object' || Array.isArray(finish) ||
      Object.keys(finish).some((key) => !['texture', 'color', 'tileSizeMm', 'rotation'].includes(key)) ||
      (typeof finish.texture !== 'string' || !['none', 'wood', 'tile'].includes(finish.texture) && !surfaceMaterial(finish.texture)) ||
      typeof finish.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(finish.color) ||
      typeof finish.tileSizeMm !== 'number' || !Number.isFinite(finish.tileSizeMm) || finish.tileSizeMm < 50 || finish.tileSizeMm > 10000 ||
      typeof finish.rotation !== 'number' || !Number.isFinite(finish.rotation))
      throw new Error('Acabado de zona de diseño inválido');
  }
}
