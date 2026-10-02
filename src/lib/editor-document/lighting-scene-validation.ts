/** Validación estructural de escenas de iluminación por estancia, sin derivar estancias. */
export const MAX_LIGHTING_SCENES = 24;
export const MAX_SCENES_PER_ROOM = 4;
export const MAX_SCENE_NAME_LENGTH = 40;
export const MAX_SCENE_OFF_IDS = 64;

function fail(message: string): never { throw new Error(message); }
function collection(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > MAX_LIGHTING_SCENES)
    fail(`Colección de escenas de iluminación inválida (máximo ${MAX_LIGHTING_SCENES})`);
  return (value as unknown[]).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Escena de iluminación inválida');
    return item as Record<string, unknown>;
  });
}
function entity(item: Record<string, unknown>, allowed: string, ids: Set<string>): void {
  if (Object.keys(item).some((key) => !allowed.split(' ').includes(key)))
    fail('Campo de escena de iluminación desconocido');
  if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id))
    fail('ID de escena de iluminación inválido o duplicado');
  ids.add(item.id);
}
function number(value: unknown, min: number, max: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    fail(`${name} fuera de rango (${min}–${max})`);
}
/** Mismo formato `room:[...]` que `Ceiling.roomId`. */
function roomId(value: unknown): void {
  if (typeof value !== 'string' || !value.startsWith('room:')) fail('Estancia de la escena inválida');
  let boundary: unknown;
  try {
    boundary = JSON.parse(value.slice(5));
  } catch {
    fail('Estancia de la escena inválida');
  }
  if (!Array.isArray(boundary) || boundary.length < 3 || boundary.some((id) => typeof id !== 'string' || !id))
    fail('Estancia de la escena inválida');
}
function references(value: unknown, known: ReadonlySet<string>, name: string): void {
  if (!Array.isArray(value) || value.length > MAX_SCENE_OFF_IDS)
    fail(`Lista de ${name} apagadas inválida (máximo ${MAX_SCENE_OFF_IDS})`);
  const seen = new Set<string>();
  for (const id of value as unknown[]) {
    if (typeof id !== 'string' || !known.has(id)) fail(`La escena apaga ${name} que ya no existen`);
    if (seen.has(id)) fail(`La escena repite ${name} apagadas`);
    seen.add(id);
  }
}

export function assertLightingSceneFields(
  doc: Record<string, unknown>,
  ids: Set<string>,
  lightIds: ReadonlySet<string>,
): void {
  if (doc.lightingScenes === undefined) return;
  const stripIds = new Set<string>(
    (Array.isArray(doc.lightStrips) ? doc.lightStrips : []).map(
      (strip) => (strip as Record<string, unknown>)?.id as string,
    ),
  );
  const perRoom = new Map<string, number>(),
    activeRooms = new Set<string>();
  for (const item of collection(doc.lightingScenes)) {
    entity(item, 'id roomId name temperatureK intensityPct offLightIds offStripIds active', ids);
    roomId(item.roomId);
    const room = item.roomId as string;
    const count = (perRoom.get(room) ?? 0) + 1;
    if (count > MAX_SCENES_PER_ROOM) fail(`Máximo ${MAX_SCENES_PER_ROOM} escenas por estancia`);
    perRoom.set(room, count);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > MAX_SCENE_NAME_LENGTH)
      fail(`Nombre de la escena inválido (1–${MAX_SCENE_NAME_LENGTH} caracteres)`);
    number(item.temperatureK, 1800, 6500, 'Temperatura de la escena');
    number(item.intensityPct, 10, 150, 'Intensidad de la escena');
    if (!Number.isInteger(item.intensityPct)) fail('La intensidad de la escena se expresa en enteros');
    references(item.offLightIds, lightIds, 'luminarias');
    references(item.offStripIds, stripIds, 'tiras LED');
    if (typeof item.active !== 'boolean') fail('Escena activa inválida');
    if (item.active) {
      if (activeRooms.has(room)) fail('Solo puede haber una escena activa por estancia');
      activeRooms.add(room);
    }
  }
}
