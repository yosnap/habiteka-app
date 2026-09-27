import { surfaceMaterial } from './surface-materials';

/**
 * Validación estructural sin derivar estancias: evita ciclos con deriveRooms.
 * Devuelve los ids de techos y luminarias para que las tiras y las escenas
 * comprueben a qué apuntan sin volver a recorrer las colecciones.
 */
/** Rango del flujo luminoso de una luminaria; lo comparte el cálculo de escenas. */
export const LUMINAIRE_LUMENS_RANGE = [50, 10_000] as const;

export function assertCeilingFields(
  doc: Record<string, unknown>,
  ids: Set<string>,
  version: number,
): { ceilingIds: Set<string>; lightIds: Set<string> } {
  const ceilings = collection(doc.ceilings, 100, 'techos');
  const lights = collection(doc.luminaires, 64, 'luminarias');
  const ceilingIds = new Set<string>(), lightIds = new Set<string>(), rooms = new Set<string>();
  const oriented = version >= 12;
  for (const item of ceilings) {
    entity(item, 'id roomId kind dropMm color topMaterialId edgeMaterialId roofThicknessMm', ids);
    if (typeof item.roomId !== 'string' || !item.roomId.startsWith('room:')) fail('Estancia del techo inválida');
    let boundary: unknown;
    try { boundary = JSON.parse(item.roomId.slice(5)); } catch { fail('Estancia del techo inválida'); }
    if (!Array.isArray(boundary) || boundary.length < 3 || boundary.some((id) => typeof id !== 'string' || !id)) fail('Estancia del techo inválida');
    if (rooms.has(item.roomId)) fail('Solo se admite un techo por estancia');
    rooms.add(item.roomId);
    if (item.kind !== 'plain' && item.kind !== 'suspended') fail('Tipo de techo inválido');
    number(item.dropMm, 0, 1000, 'Descenso del techo');
    if (item.kind === 'plain' && item.dropMm !== 0) fail('Un techo plano no tiene descenso');
    if (item.kind === 'suspended' && (item.dropMm as number) < 80) fail('El falso techo necesita al menos 8 cm de descenso');
    color(item.color);
    if (item.topMaterialId !== undefined &&
      (typeof item.topMaterialId !== 'string' || !surfaceMaterial(item.topMaterialId)))
      fail('Material de la cara superior del techo inválido');
    if (item.edgeMaterialId !== undefined &&
      (typeof item.edgeMaterialId !== 'string' || !surfaceMaterial(item.edgeMaterialId)))
      fail('Material del canto de cubierta inválido');
    if (item.roofThicknessMm !== undefined) number(item.roofThicknessMm, 80, 400, 'Espesor de cubierta');
    ceilingIds.add(item.id as string);
  }
  for (const item of lights) {
    entity(item, `id ceilingId kind x y dropMm color temperatureK lumens enabled${oriented ? ' mount tiltDeg azimuthDeg' : ''}`, ids);
    if (typeof item.ceilingId !== 'string' || !ceilingIds.has(item.ceilingId)) fail('Luminaria sin techo');
    if (!['pendant', 'flush', 'recessed', ...(oriented ? ['spot'] : [])].includes(item.kind as string)) fail('Tipo de luminaria inválido');
    number(item.x, -1e8, 1e8, 'Posición X'); number(item.y, -1e8, 1e8, 'Posición Y');
    const spot = item.kind === 'spot';
    if (spot) {
      if (item.mount !== 'recessed' && item.mount !== 'surface') fail('El foco orientable necesita montaje empotrado o en superficie');
      number(item.tiltDeg, 0, 60, 'Inclinación del foco');
      number(item.azimuthDeg, 0, 360, 'Giro del foco');
      number(item.dropMm, 0, 300, 'Caída del foco');
      // Empotrado: la carcasa queda dentro del falso techo, sin caída posible.
      if (item.mount === 'recessed' && item.dropMm !== 0) fail('Un foco empotrado no admite caída');
    } else {
      if (item.mount !== undefined || item.tiltDeg !== undefined || item.azimuthDeg !== undefined)
        fail('Solo el foco orientable admite montaje, inclinación y giro');
      number(item.dropMm, 0, 5000, 'Caída');
      if (item.kind !== 'pendant' && item.dropMm !== 0) fail('Solo las lámparas colgantes admiten caída');
    }
    number(item.temperatureK, 1800, 6500, 'Temperatura'); number(item.lumens, ...LUMINAIRE_LUMENS_RANGE, 'Flujo luminoso');
    color(item.color);
    if (typeof item.enabled !== 'boolean') fail('Encendido inválido');
    lightIds.add(item.id as string);
  }
  return { ceilingIds, lightIds };
}
function fail(message: string): never { throw new Error(message); }
function collection(value: unknown, limit: number, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > limit) fail(`Colección de ${name} inválida (máximo ${limit})`);
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`Entidad de ${name} inválida`);
    return item as Record<string, unknown>;
  });
}
function entity(item: Record<string, unknown>, allowed: string, ids: Set<string>): void {
  if (Object.keys(item).some((key) => !allowed.split(' ').includes(key))) fail('Campo de techo o luminaria desconocido');
  if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id)) fail('ID de techo o luminaria inválido o duplicado');
  ids.add(item.id);
}
function number(value: unknown, min: number, max: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${name} fuera de rango (${min}–${max})`);
}
function color(value: unknown): void {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail('Color de techo o luminaria inválido');
}
