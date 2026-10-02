import type { EditorDocument, Luminaire, Point } from './schema';
import { ceilingSurfaces, luminairePlacementIssue, insideRoom, boundaryClearance, spotAimIssue } from './ceiling-geometry';
import { objectCenter } from './spatial-properties';
import { floorFinish } from './floor-finishes';
import { pointInZoneParts } from './lighting-zone';
import { planObjects } from './boundary-types';

export interface LightingProposal {
  ceilingId: string;
  style: string;
  lights: Omit<Luminaire, 'id'>[];
  /** La propuesta incluye foseado perimetral: lo crea `addCoveStrip` al aceptarla. */
  cove?: boolean;
  warnings: string[];
}

export interface LightingProposalOptions {
  /**
   * Zona de luces guardada: la propuesta no coloca nada fuera de sus contornos.
   * Se da en milímetros, igual que `LightZone.polygonsMm`, y admite una zona de
   * varias partes sueltas.
   */
  zonePolygonsMm?: readonly (readonly Point[])[];
  /** Focos orientables de acento hacia paredes con algo que iluminar (cuadro, TV, mueble). */
  accentSpots?: boolean;
  /** Foseado perimetral; solo se propone si la estancia tiene falso techo de 8 cm o más. */
  cove?: boolean;
}

/** Separación del foco de acento respecto a la pared que lava, y su inclinación máxima. */
const ACCENT_OFFSET_MM = 1200, ACCENT_MAX_TILT_DEG = 60;
/** Distancia a la que un objeto se considera apoyado en esa pared. */
const ACCENT_OBJECT_REACH_MM = 900;
/** Pared demasiado corta para merecer un baño de luz. */
const ACCENT_MIN_WALL_MM = 1200;

/** Propuesta local y determinista, basada en uso/estilo/geometría; no simula una llamada IA. */
export function proposeLighting(doc: EditorDocument, ceilingId: string, style: string, options: LightingProposalOptions = {}): LightingProposal {
  const surface = ceilingSurfaces(doc).find((item) => item.ceiling.id === ceilingId);
  if (!surface) throw new Error('Activa un techo válido antes de proponer iluminación');
  const zone = options.zonePolygonsMm?.length ? options.zonePolygonsMm : undefined;
  const inScope = (point: Point) => !zone || pointInZoneParts(point, zone);
  const proposal: LightingProposal = { ceilingId, style, lights: [], warnings: [] };
  const normalized = style.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const warm = /mediterr|rustic|boho|costero|japandi/.test(normalized);
  const color = warm ? '#d8b982' : '#f4f1e9', temperatureK = warm ? 2700 : 3000;
  const { room } = surface;
  const minX = Math.min(...room.boundary.map((point) => point.x)), maxX = Math.max(...room.boundary.map((point) => point.x));
  const minY = Math.min(...room.boundary.map((point) => point.y)), maxY = Math.max(...room.boundary.map((point) => point.y));
  const candidates: Point[] = [];
  // Muestreo acotado que también funciona en habitaciones cóncavas.
  for (let row = 1; row < 12; row++) for (let col = 1; col < 12; col++) {
    const point = { x: minX + (maxX - minX) * col / 12, y: minY + (maxY - minY) * row / 12 };
    if (insideRoom(point, room.boundary) && inScope(point)) candidates.push(point);
  }
  const accepted: Luminaire[] = [];
  const add = (point: Point, kind: Luminaire['kind'], orientation?: Pick<Luminaire, 'mount' | 'tiltDeg' | 'azimuthDeg'>) => {
    if (!inScope(point)) return false;
    const light: Luminaire = { id: `proposal:${accepted.length}`, ceilingId, kind, x: Math.round(point.x), y: Math.round(point.y),
      dropMm: kind === 'pendant' ? Math.max(0, Math.min(warm ? 350 : 250, surface.heightMm - 2320)) : 0,
      color, temperatureK, lumens: kind === 'recessed' ? 650 : kind === 'spot' ? 550 : warm ? 1000 : 1200, enabled: true,
      ...orientation };
    const draft = { ...doc, luminaires: [...(doc.luminaires ?? []), ...accepted] };
    if (luminairePlacementIssue(draft, light) || spotAimIssue(draft, light)) return false;
    accepted.push(light); return true;
  };
  // Solo objetos físicos confirmados; el mobiliario raster pendiente no orienta colgantes.
  const tables = doc.furniture.filter((item) => item.dimensionalOrigin === 'physical' &&
    /table|mesa|island|isla/.test(`${item.kind} ${item.catalogId ?? ''}`) && insideRoom(objectCenter(item), room.boundary));
  for (const table of tables.slice(0, 2)) add(objectCenter(table), 'pendant');
  if (options.accentSpots) {
    const walls = accentWalls(doc, room.boundary);
    if (!walls.length) proposal.warnings.push('Sin pared con un objeto que realzar: no se proponen focos de acento.');
    const clearanceMm = Math.max(1, surface.heightMm - (floorFinish(doc, room.id).elevationMm ?? 0));
    const mount = surface.ceiling.kind === 'suspended' && surface.ceiling.dropMm >= 80 ? 'recessed' as const : 'surface' as const;
    for (const wall of walls.slice(0, 2)) {
      const aimed = accentSpot(wall, clearanceMm, room.boundary);
      if (aimed) add(aimed.point, 'spot', { ...aimed.orientation, mount });
    }
  }
  const count = Math.min(8, Math.max(1, Math.ceil(room.areaMm2 / 8e6)));
  while (accepted.length < count && candidates.length) {
    const existing = [...(doc.luminaires ?? []).filter((light) => light.ceilingId === ceilingId), ...accepted];
    candidates.sort((a, b) => score(b) - score(a));
    function score(point: Point) {
      const clearance = boundaryClearance(point, room.boundary);
      const spacing = existing.length ? Math.min(...existing.map((light) => Math.hypot(point.x - light.x, point.y - light.y))) : clearance;
      return Math.min(clearance * 2, spacing);
    }
    const candidate = candidates.shift()!;
    if (existing.some((light) => Math.hypot(light.x - candidate.x, light.y - candidate.y) < 1000)) continue;
    add(candidate, surface.ceiling.kind === 'suspended' && !warm ? 'recessed' : 'flush');
  }
  // El id provisional solo ordenaba la propuesta: la luz real lo recibe al aceptarse.
  proposal.lights = accepted.map((light) => without(light, 'id'));
  if (options.cove) {
    const suspended = surface.ceiling.kind === 'suspended' && surface.ceiling.dropMm >= 80;
    const taken = (doc.lightStrips ?? []).some((strip) => strip.kind === 'cove' && strip.ceilingId === ceilingId);
    if (suspended && !taken) proposal.cove = true;
    else proposal.warnings.push(suspended
      ? 'Esta estancia ya tiene foseado: no se propone otro.'
      : 'Sin falso techo de 8 cm o más: no se propone foseado perimetral.');
  }
  if (accepted.length < count) proposal.warnings.push('No hay espacio libre para toda la propuesta; se incluyen solo las luminarias que caben.');
  if (!tables.length) proposal.warnings.push('Sin mesa o isla confirmada: se propone iluminación general, sin colgantes sobre muebles importados.');
  if (zone) proposal.warnings.push('Propuesta acotada a la zona activa: fuera de su contorno no se coloca ninguna luz.');
  proposal.warnings.push('Distribución orientativa de diseño; revisa posición, caída e intensidad antes de aceptar.');
  return proposal;
}

/**
 * Paredes de la estancia con algo que realzar: un objeto físico apoyado contra
 * ellas. Sin objeto no se propone acento, para no dejar focos apuntando a nada.
 */
function accentWalls(doc: EditorDocument, boundary: Point[]): { a: Point; b: Point }[] {
  const objects = planObjects(doc)
    .filter((item) => item.dimensionalOrigin === 'physical')
    .map(objectCenter)
    .filter((point) => insideRoom(point, boundary));
  if (!objects.length) return [];
  const walls: { a: Point; b: Point; distance: number }[] = [];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!, b = boundary[(i + 1) % boundary.length]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < ACCENT_MIN_WALL_MM) continue;
    const distance = Math.min(...objects.map((point) => distanceToSegment(point, a, b)));
    if (distance <= ACCENT_OBJECT_REACH_MM) walls.push({ a, b, distance });
  }
  return walls.sort((x, y) => x.distance - y.distance).map(({ a, b }) => ({ a, b }));
}

/** Posición e inclinación de un foco que lava la pared indicada desde dentro de la estancia. */
function accentSpot(wall: { a: Point; b: Point }, clearanceMm: number, boundary: Point[]) {
  const target = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  // Normal hacia dentro: el lado del segmento en el que está la estancia.
  const normal = { x: -(wall.b.y - wall.a.y) / length, y: (wall.b.x - wall.a.x) / length };
  const inward = insideRoom({ x: target.x + normal.x * 100, y: target.y + normal.y * 100 }, boundary)
    ? normal : { x: -normal.x, y: -normal.y };
  const tiltDeg = Math.min(ACCENT_MAX_TILT_DEG, Math.round(Math.atan2(ACCENT_OFFSET_MM, clearanceMm) * 180 / Math.PI));
  // Con la inclinación acotada, el foco se acerca hasta donde su haz llega a la pared.
  const offset = Math.min(ACCENT_OFFSET_MM, clearanceMm * Math.tan(tiltDeg * Math.PI / 180));
  const point = { x: target.x + inward.x * offset, y: target.y + inward.y * offset };
  if (!insideRoom(point, boundary)) return null;
  const azimuthDeg = Math.round((Math.atan2(-inward.y, -inward.x) * 180 / Math.PI + 360)) % 360;
  return { point, orientation: { tiltDeg, azimuthDeg } };
}

const without = (light: Luminaire, key: 'id'): Omit<Luminaire, 'id'> =>
  Object.fromEntries(Object.entries(light).filter(([name]) => name !== key)) as Omit<Luminaire, 'id'>;

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
  const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Resultado de la propuesta de planta: qué se propone y qué se dejó fuera. */
export interface PlanLightingProposal {
  proposals: LightingProposal[];
  /** Techos que ya tenían luces y se saltaron por no haber pedido incluirlos. */
  skippedLit: number;
}

/**
 * Propuesta para toda la planta: por defecto solo para los techos que todavía
 * no tienen luces, para no duplicar luminarias. Con `includeLit` también se
 * propone donde ya hay luz; la propuesta respeta la separación mínima con las
 * luminarias existentes, así que añade sin superponer.
 */
export function proposeLightingForPlan(
  doc: EditorDocument,
  style: string,
  options: LightingProposalOptions & { includeLit?: boolean } = {},
): PlanLightingProposal {
  const lit = new Set((doc.luminaires ?? []).map((light) => light.ceilingId));
  const surfaces = ceilingSurfaces(doc);
  const chosen = options.includeLit ? surfaces : surfaces.filter(({ ceiling }) => !lit.has(ceiling.id));
  return {
    proposals: chosen
      .map(({ ceiling }) => proposeLighting(doc, ceiling.id, style, options))
      .filter((proposal) => proposal.lights.length > 0 || proposal.cove),
    skippedLit: options.includeLit ? 0 : surfaces.filter(({ ceiling }) => lit.has(ceiling.id)).length,
  };
}
