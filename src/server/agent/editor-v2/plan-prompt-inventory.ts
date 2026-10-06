import type { Point } from '@/lib/editor-document/schema';
import { EXTERIOR_RENDER_POLICY, type ExteriorDesignElement } from '@/lib/editor-document/exterior-design-context';
import { CRITICAL_FIXTURE_RULE, FIXTURE_KINDS, type CriticalFixtureGroup, type FixtureKind } from '@/lib/editor-document/critical-fixtures';

/**
 * Resúmenes breves para los prompts de imagen. El inventario completo, con identificadores y coordenadas, solo lo
 * necesita la auditoría: en el prompt de imagen pasaba de 20 000 caracteres, los modelos KIE lo rechazaban y el
 * respaldo reinventaba la distribución. La cenital sitúa cada elemento en el plano adjunto; en las vistas en perspectiva
 * la captura ya lo muestra y solo se nombra, porque arriba o izquierda del plano no son los de la imagen.
 */
export interface PlanBox { x: number; y: number; width: number; height: number }

const ROWS = ['arriba', '', 'abajo'], COLUMNS = ['izquierda', 'centro', 'derecha'];
const MAX_SECTION_CHARS = 220, MAX_FIXTURE_CHARS = 500, MAX_POSITIONS = 4;

/** «arriba izquierda», «centro», «abajo»… según el tercio que ocupa el punto dentro del rectángulo. */
export function planPlacement(point: Point, box: PlanBox): string {
  // Sin extensión en un eje (una sola estancia sin contorno), la posición es el centro.
  const third = (value: number, min: number, span: number) => span > 0 ? Math.min(2, Math.max(0, Math.floor((value - min) / span * 3))) : 1;
  const row = ROWS[third(point.y, box.y, box.height)]!, column = COLUMNS[third(point.x, box.x, box.width)]!;
  return row ? (column === 'centro' ? row : `${row} ${column}`) : column;
}

export function pointsBox(points: readonly Point[]): PlanBox {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export const centroid = (points: readonly Point[]): Point => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
  y: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length),
});
const lower = (text: string) => text.trim().replace(/\s*·\s*modelo 3d$/i, '').toLowerCase();
const boxArea = (points: readonly Point[]) => { const box = pointsBox(points); return box.width * box.height; };
const meters = (mm: number) => `${(mm / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} m`;

/** Cierra la lista sin cortar una entrada a medias cuando supera su tope; lo omitido sigue dibujado en el plano. */
export function capped(parts: readonly string[], max: number, separator = '; '): string {
  const kept: string[] = [];
  for (const part of parts) {
    if ([...kept, part].join(separator).length > max)
      return kept.length ? `${kept.join(separator)}${separator}y otros dibujados en el plano` : 'los dibujados en el plano';
    kept.push(part);
  }
  return kept.join(separator);
}

function grouped(items: { name: string; at: Point }[], box?: PlanBox): string[] {
  const groups = new Map<string, Point[]>();
  for (const item of items) groups.set(item.name, [...groups.get(item.name) ?? [], item.at]);
  return [...groups].map(([name, points]) => {
    const where = box && points.length <= MAX_POSITIONS ? [...new Set(points.map((point) => planPlacement(point, box)))].join(', ') : '';
    return `${name}${points.length > 1 ? ` ×${points.length}` : ''}${where ? ` (${where})` : ''}`;
  });
}

/** Sin `box` es la versión de las vistas en perspectiva: sin posiciones y con la política completa de esas vistas. */
export function exteriorPlanSummary(elements: readonly ExteriorDesignElement[], box?: PlanBox): string[] {
  if (!elements.length) return [];
  const planArea = Math.max(1, box ? box.width * box.height : boxArea(elements.flatMap((item) => item.footprint)));
  const of = (category: ExteriorDesignElement['category']) => elements.filter((item) => item.category === category);
  // El material conserva su nombre del catálogo («Césped verde PBR»): la auditoría lo busca tal cual.
  const surfaceName = (item: ExteriorDesignElement) => (('material' in item && item.material) || item.name).trim();
  const surfaces = of('surface').filter((item) => !('visibleInPlan' in item && item.visibleInPlan === false));
  const wide = (item: ExteriorDesignElement) => boxArea(item.footprint) > planArea * .5;
  const surfaceParts = [...new Set(surfaces.filter(wide).map(surfaceName))].map((name) => `${name} (todo el terreno)`)
    .concat(grouped(surfaces.filter((item) => !wide(item)).map((item) => ({ name: surfaceName(item), at: centroid(item.footprint) })), box));
  const fenceCounts = new Map<string, { runs: number; gates: number }>();
  for (const item of of('boundary')) {
    const key = `${lower(item.name)}${'heightMm' in item && item.heightMm ? ` de ${meters(item.heightMm)}` : ''}`;
    const count = fenceCounts.get(key) ?? { runs: 0, gates: 0 };
    count.runs++;
    count.gates += 'construction' in item && item.construction ? item.construction.gates.length : 0;
    fenceCounts.set(key, count);
  }
  const fences = [...fenceCounts].map(([key, { runs, gates }]) => `${key} (${runs} ${runs > 1 ? 'tramos' : 'tramo'}${
    gates ? `, ${gates} ${gates > 1 ? 'puertas' : 'puerta'} con su apertura` : ''})`);
  const named = (category: ExteriorDesignElement['category']) => grouped(of(category)
    .map((item) => ({ name: lower(item.name), at: centroid(item.footprint) })), box);
  const list = (label: string, parts: string[]) => parts.length ? `${label}: ${capped(parts, MAX_SECTION_CHARS, ', ')}` : '';
  // Los vehículos primero: son lo que el respaldo más confundía con muebles.
  const sections = [list('vehículos', named('vehicle')), list('superficies', surfaceParts), list('cercos', fences),
    list('equipamiento', named('equipment')), list('vegetación', named('vegetation'))].filter(Boolean);
  return [
    box ? 'EXTERIOR DEL PLANO: conserva cada superficie con su material (el césped sigue siendo césped, nunca tierra ni pavimento), los cercos y setos con sus puertas, la vegetación, el equipamiento y los vehículos en su sitio y con su orientación. Cada vehículo sigue siendo un vehículo del mismo tipo, nunca un mueble. No añadas paisaje fuera del terreno.'
      : EXTERIOR_RENDER_POLICY,
    box ? `Exterior (posiciones en la imagen): ${sections.join('; ')}.` : `Exterior del proyecto, si aparece en esta cámara: ${sections.join('; ')}.`,
  ];
}

const FIXTURE_NAMES: Record<FixtureKind, [string, string]> = {
  toilet: ['inodoro', 'inodoros'], washbasin: ['lavabo', 'lavabos'], bidet: ['bidé', 'bidés'], bath: ['bañera', 'bañeras'],
  shower: ['ducha', 'duchas'], 'kitchen-sink': ['fregadero', 'fregaderos'], cooktop: ['placa de cocción', 'placas de cocción'],
};

/** Recuentos por estancia; en la cenital, la posición distingue dos estancias con el mismo nombre. */
export function fixturePlanSummary(groups: readonly CriticalFixtureGroup[], roomsBox?: PlanBox): string[] {
  const parts = groups.filter((group) => group.items.length).map((group) => {
    const counts = FIXTURE_KINDS.filter((kind) => group.counts[kind] > 0)
      .map((kind) => `${group.counts[kind]} ${FIXTURE_NAMES[kind][group.counts[kind] > 1 ? 1 : 0]}`);
    const where = roomsBox ? ` (${planPlacement(centroid(group.items.map((item) => item.center)), roomsBox)})` : '';
    return `${group.name}${where}: ${counts.join(', ')}`;
  });
  if (!parts.length) return [];
  return [
    roomsBox ? 'SANITARIOS Y COCINA: conserva el número y la función de cada pieza por estancia. Un inodoro, un lavabo y una ducha son piezas distintas; no dupliques ni omitas ninguna. Cada placa se ve como placa, con sus zonas de cocción y sin objetos encima.'
      : CRITICAL_FIXTURE_RULE,
    `Piezas por estancia: ${capped(parts, MAX_FIXTURE_CHARS)}.`,
  ];
}
