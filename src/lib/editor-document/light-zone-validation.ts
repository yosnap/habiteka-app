/**
 * Validación estructural de zonas de luces guardadas. Mismo contrato de
 * polígono que las zonas de render (`renderDesignOptionsSchema.regions`), con
 * la comprobación de lazos reutilizada de `polygon-tools`.
 */
import { polygonSelfIntersects } from './polygon-tools';

/** Mismo tope que `MAX_REGIONS` en el selector de zonas de render. */
export const MAX_LIGHT_ZONES = 12;
/** Partes (polígonos sueltos) que puede tener una misma zona. */
export const MAX_ZONE_PARTS = 12;
export const MIN_ZONE_VERTICES = 3;
export const MAX_ZONE_VERTICES = 20;
export const MAX_ZONE_NAME_LENGTH = 40;

function fail(message: string): never { throw new Error(message); }
function collection(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > MAX_LIGHT_ZONES)
    fail(`Colección de zonas de luces inválida (máximo ${MAX_LIGHT_ZONES})`);
  return (value as unknown[]).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Zona de luces inválida');
    return item as Record<string, unknown>;
  });
}
function entity(item: Record<string, unknown>, allowed: string, ids: Set<string>): void {
  if (Object.keys(item).some((key) => !allowed.split(' ').includes(key))) fail('Campo de zona de luces desconocido');
  if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id))
    fail('ID de zona de luces inválido o duplicado');
  ids.add(item.id);
}
function polygon(value: unknown): void {
  if (!Array.isArray(value) || value.length < MIN_ZONE_VERTICES || value.length > MAX_ZONE_VERTICES)
    fail(`Contorno de la zona de luces inválido (${MIN_ZONE_VERTICES}–${MAX_ZONE_VERTICES} vértices)`);
  const points = (value as unknown[]).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Vértice de la zona de luces inválido');
    const point = raw as Record<string, unknown>;
    if (Object.keys(point).some((key) => key !== 'x' && key !== 'y')) fail('Vértice de la zona de luces inválido');
    for (const coordinate of [point.x, point.y])
      if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || Math.abs(coordinate) > 1e8)
        fail('Vértice de la zona de luces inválido');
    return { x: point.x as number, y: point.y as number };
  });
  if (polygonSelfIntersects(points)) fail('El contorno de la zona de luces se cruza consigo mismo');
  let twiceArea = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    twiceArea += points[j]!.x * points[i]!.y - points[i]!.x * points[j]!.y;
  if (Math.abs(twiceArea) / 2 <= 0) fail('La zona de luces no encierra ninguna superficie');
}

/** Una zona son de 1 a `MAX_ZONE_PARTS` contornos válidos, contiguos o no. */
function polygons(value: unknown): void {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ZONE_PARTS)
    fail(`La zona de luces necesita entre 1 y ${MAX_ZONE_PARTS} contornos`);
  for (const part of value) polygon(part);
}

export function assertLightZoneFields(doc: Record<string, unknown>, ids: Set<string>): void {
  if (doc.lightZones === undefined) return;
  const names = new Set<string>();
  for (const item of collection(doc.lightZones)) {
    entity(item, 'id name polygonsMm', ids);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > MAX_ZONE_NAME_LENGTH)
      fail(`Nombre de la zona de luces inválido (1–${MAX_ZONE_NAME_LENGTH} caracteres)`);
    const name = item.name.trim();
    if (names.has(name)) fail('Ya hay otra zona de luces con ese nombre');
    names.add(name);
    polygons(item.polygonsMm);
  }
}
