import type { EditorDocument, Luminaire, Point } from './schema';
import { ceilingSurfaces, luminairePlacementIssue, insideRoom, boundaryClearance } from './ceiling-geometry';
import { objectCenter } from './spatial-properties';

export interface LightingProposal {
  ceilingId: string;
  style: string;
  lights: Omit<Luminaire, 'id'>[];
  warnings: string[];
}
/** Propuesta local y determinista, basada en uso/estilo/geometría; no simula una llamada IA. */
export function proposeLighting(doc: EditorDocument, ceilingId: string, style: string): LightingProposal {
  const surface = ceilingSurfaces(doc).find((item) => item.ceiling.id === ceilingId);
  if (!surface) throw new Error('Activa un techo válido antes de proponer iluminación');
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
    if (insideRoom(point, room.boundary)) candidates.push(point);
  }
  const accepted: Luminaire[] = [];
  const add = (point: Point, kind: Luminaire['kind']) => {
    const light: Luminaire = { id: `proposal:${accepted.length}`, ceilingId, kind, x: Math.round(point.x), y: Math.round(point.y),
      dropMm: kind === 'pendant' ? Math.max(0, Math.min(warm ? 350 : 250, surface.heightMm - 2320)) : 0,
      color, temperatureK, lumens: kind === 'recessed' ? 650 : warm ? 1000 : 1200, enabled: true };
    if (luminairePlacementIssue({ ...doc, luminaires: [...(doc.luminaires ?? []), ...accepted] }, light)) return false;
    accepted.push(light); return true;
  };
  // Solo objetos físicos confirmados; el mobiliario raster pendiente no orienta colgantes.
  const tables = doc.furniture.filter((item) => item.dimensionalOrigin === 'physical' &&
    /table|mesa|island|isla/.test(`${item.kind} ${item.catalogId ?? ''}`) && insideRoom(objectCenter(item), room.boundary));
  for (const table of tables.slice(0, 2)) add(objectCenter(table), 'pendant');
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
  proposal.lights = accepted.map((light) => ({ ceilingId: light.ceilingId, kind: light.kind, x: light.x, y: light.y,
    dropMm: light.dropMm, color: light.color, temperatureK: light.temperatureK, lumens: light.lumens, enabled: light.enabled }));
  if (accepted.length < count) proposal.warnings.push('No hay espacio libre para toda la propuesta; se incluyen solo las luminarias que caben.');
  if (!tables.length) proposal.warnings.push('Sin mesa o isla confirmada: se propone iluminación general, sin colgantes sobre muebles importados.');
  proposal.warnings.push('Distribución orientativa de diseño; revisa posición, caída e intensidad antes de aceptar.');
  return proposal;
}

/**
 * Propuesta para toda la planta: una por cada techo que todavía no tiene luces.
 * Los techos ya iluminados no se tocan para no duplicar luminarias.
 */
export function proposeLightingForPlan(doc: EditorDocument, style: string): LightingProposal[] {
  const lit = new Set((doc.luminaires ?? []).map((light) => light.ceilingId));
  return ceilingSurfaces(doc)
    .filter(({ ceiling }) => !lit.has(ceiling.id))
    .map(({ ceiling }) => proposeLighting(doc, ceiling.id, style))
    .filter((proposal) => proposal.lights.length > 0);
}
