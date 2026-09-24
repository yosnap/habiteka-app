/** Validación estructural de tiras LED, sin derivar estancias: evita ciclos con deriveRooms. */
import {
  MAX_LIGHT_STRIPS,
  MAX_STRIP_ELEVATION_MM,
  MAX_STRIP_LENGTH_MM,
  MAX_STRIP_POINTS,
  MIN_STRIP_POINTS,
  MIN_STRIP_SEGMENT_MM,
  STRIP_KINDS,
  stripLengthMm,
} from './light-strip-types';

function fail(message: string): never { throw new Error(message); }
function collection(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > MAX_LIGHT_STRIPS)
    fail(`Colección de tiras LED inválida (máximo ${MAX_LIGHT_STRIPS})`);
  return (value as unknown[]).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Tira LED inválida');
    return item as Record<string, unknown>;
  });
}
function entity(item: Record<string, unknown>, allowed: string, ids: Set<string>): void {
  if (Object.keys(item).some((key) => !allowed.split(' ').includes(key))) fail('Campo de tira LED desconocido');
  if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id))
    fail('ID de tira LED inválido o duplicado');
  ids.add(item.id);
}
function number(value: unknown, min: number, max: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    fail(`${name} fuera de rango (${min}–${max})`);
}
function color(value: unknown): void {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail('Color de tira LED inválido');
}
function path(value: unknown): { x: number; y: number }[] {
  if (!Array.isArray(value) || value.length < MIN_STRIP_POINTS || value.length > MAX_STRIP_POINTS)
    fail(`Recorrido de la tira LED inválido (${MIN_STRIP_POINTS}–${MAX_STRIP_POINTS} puntos)`);
  const points = (value as unknown[]).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Punto del recorrido de la tira LED inválido');
    const point = raw as Record<string, unknown>;
    if (Object.keys(point).some((key) => key !== 'x' && key !== 'y'))
      fail('Punto del recorrido de la tira LED inválido');
    number(point.x, -1e8, 1e8, 'Posición X de la tira');
    number(point.y, -1e8, 1e8, 'Posición Y de la tira');
    return { x: point.x as number, y: point.y as number };
  });
  for (let i = 1; i < points.length; i++)
    if (Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y) < MIN_STRIP_SEGMENT_MM)
      fail(`El recorrido de la tira LED tiene dos puntos a menos de ${MIN_STRIP_SEGMENT_MM} mm`);
  if (stripLengthMm(points) > MAX_STRIP_LENGTH_MM)
    fail(`La tira LED supera los ${MAX_STRIP_LENGTH_MM / 1000} m de recorrido`);
  return points;
}

export function assertLightStripFields(
  doc: Record<string, unknown>,
  ids: Set<string>,
  ceilingIds: ReadonlySet<string>,
): void {
  if (doc.lightStrips === undefined) return;
  const runIds = new Set(
    (Array.isArray(doc.kitchenRuns) ? doc.kitchenRuns : []).map((run) => (run as Record<string, unknown>)?.id),
  );
  const coveByCeiling = new Set<string>(),
    stripByRun = new Set<string>();
  for (const item of collection(doc.lightStrips)) {
    entity(item, 'id kind ceilingId kitchenRunId pathMm derived elevationMm color temperatureK lumensPerMeter enabled', ids);
    if (!STRIP_KINDS.includes(item.kind as never)) fail('Tipo de tira LED inválido');
    if (item.kind === 'cove') {
      if (typeof item.ceilingId !== 'string' || !ceilingIds.has(item.ceilingId)) fail('Foseado sin techo');
      if (coveByCeiling.has(item.ceilingId)) fail('Solo se admite un foseado por techo');
      coveByCeiling.add(item.ceilingId);
    } else if (item.ceilingId !== undefined) fail('Solo el foseado se ancla a un techo');
    if (item.kind === 'under-cabinet') {
      if (typeof item.kitchenRunId !== 'string' || !runIds.has(item.kitchenRunId))
        fail('Tira bajo mueble sin tramo de cocina');
      if (stripByRun.has(item.kitchenRunId)) fail('Solo se admite una tira por tramo de cocina');
      stripByRun.add(item.kitchenRunId);
    } else if (item.kitchenRunId !== undefined) fail('Solo la tira bajo mueble se ancla a un tramo de cocina');
    path(item.pathMm);
    if (typeof item.derived !== 'boolean') fail('Recorrido derivado inválido');
    if (item.kind === 'free' && item.derived) fail('Un tramo libre no se deriva de la geometría');
    number(item.elevationMm, 0, MAX_STRIP_ELEVATION_MM, 'Cota de la tira LED');
    color(item.color);
    number(item.temperatureK, 1800, 6500, 'Temperatura de la tira LED');
    number(item.lumensPerMeter, 50, 2000, 'Flujo por metro de la tira LED');
    if (typeof item.enabled !== 'boolean') fail('Encendido de la tira LED inválido');
  }
}
