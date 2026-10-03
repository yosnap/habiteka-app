import type { PlanDoorOverride, PlanPoint, PlanWallOverride, Plano2dPayload } from '@/lib/contracts';

const pointKey = (point: PlanPoint) => `${point.x},${point.y}`;
const validPoint = (point: PlanPoint) => point && Number.isFinite(point.x) && Number.isFinite(point.y)
  && Math.abs(point.x) <= 200000 && Math.abs(point.y) <= 200000;
const distance = (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** Propaga cada vértice revisado a muros, contornos y cotas que comparten ese punto. */
export function applyReviewedWalls(plano: Plano2dPayload, overrides: PlanWallOverride[] = []): Plano2dPayload {
  if (!Array.isArray(overrides) || overrides.length > 500) throw new Error('La revisión contiene demasiados muros.');
  if (!overrides.length) return plano;
  const walls = new Map(plano.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const)));
  const edits = new Map<string, PlanWallOverride>();
  const moved = new Map<string, PlanPoint>();
  for (const edit of overrides) {
    const wall = edit && walls.get(edit.wallId);
    if (!wall) throw new Error('Un muro revisado ya no existe. Recarga la revisión.');
    if (!validPoint(edit.from) || !validPoint(edit.to) || !Number.isFinite(edit.thicknessMm)
      || edit.thicknessMm < 10 || edit.thicknessMm > 1000) throw new Error('Revisa las coordenadas y el grosor del muro.');
    if (edits.has(edit.wallId)) throw new Error('Un muro aparece repetido en la revisión.');
    edits.set(edit.wallId, edit);
    for (const [before, after] of [[wall.from, edit.from], [wall.to, edit.to]] as const) {
      const key = pointKey(before), existing = moved.get(key);
      if (existing && distance(existing, after) > .01) throw new Error('Los muros unidos deben compartir la misma esquina.');
      moved.set(key, { x: after.x, y: after.y });
    }
  }
  const move = (point: PlanPoint) => moved.get(pointKey(point)) ?? point;
  const result = { ...plano, zones: plano.zones.map(zone => ({ ...zone,
    outline: zone.outline.map(move),
    dimensions: zone.dimensions.map(dimension => ({ ...dimension, from: move(dimension.from), to: move(dimension.to) })),
    walls: zone.walls.map(wall => ({ ...wall, from: move(wall.from), to: move(wall.to),
      thicknessMm: edits.get(wall.id)?.thicknessMm ?? wall.thicknessMm })),
  })) };
  const finalWalls = [...new Map(result.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const))).values()];
  if (finalWalls.some(wall => distance(wall.from, wall.to) < 50)) throw new Error('Un muro no puede medir menos de 5 cm.');
  for (const zone of result.zones) for (const aperture of zone.apertures) {
    const wall = finalWalls.find(item => item.id === aperture.wallId);
    if (wall && aperture.widthMm > distance(wall.from, wall.to))
      throw new Error('Un hueco ya no cabe en el muro corregido. Reduce primero su ancho o continúa en el Editor.');
  }
  for (let i = 0; i < finalWalls.length; i++) for (let j = i + 1; j < finalWalls.length; j++) {
    const a = finalWalls[i]!, b = finalWalls[j]!;
    const cross = (p: PlanPoint, q: PlanPoint, r: PlanPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (cross(a.from, a.to, b.from) * cross(a.from, a.to, b.to) < -1
      && cross(b.from, b.to, a.from) * cross(b.from, b.to, a.to) < -1)
      throw new Error('La corrección cruza muros sin una unión. Ajusta sus extremos o continúa en el Editor.');
  }
  return result;
}

/** Valida los huecos contra el muro final, sin recortar silenciosamente su ancho. */
export function applyReviewedDoors(plano: Plano2dPayload, overrides: PlanDoorOverride[] = []): Plano2dPayload {
  if (!Array.isArray(overrides) || overrides.length > 100) throw new Error('La revisión contiene demasiadas puertas.');
  if (!overrides.length) return plano;
  const edits = new Map(overrides.map(edit => [edit.apertureId, edit]));
  if (edits.size !== overrides.length) throw new Error('Una puerta aparece repetida en la revisión.');
  const walls = new Map(plano.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const)));
  const found = new Set<string>();
  const result = { ...plano, zones: plano.zones.map(zone => ({ ...zone,
    apertures: zone.apertures.map(aperture => {
      const edit = edits.get(aperture.id);
      if (!edit) return aperture;
      if (aperture.kind !== 'puerta') throw new Error('La corrección no corresponde a una puerta.');
      found.add(aperture.id);
      const wall = walls.get(aperture.wallId), widthMm = edit.widthMm ?? aperture.widthMm;
      if (!wall || !Number.isFinite(widthMm) || widthMm < 100 || widthMm > 10000 || widthMm > distance(wall.from, wall.to))
        throw new Error('El ancho de la puerta debe caber en su muro y medir al menos 10 cm.');
      if ((edit.swing !== undefined && !['left', 'right'].includes(edit.swing))
        || (edit.hinge !== undefined && !['left', 'right'].includes(edit.hinge))) throw new Error('Revisa el lado y la bisagra de la puerta.');
      const position = edit.position ?? aperture.position;
      if (!Number.isFinite(position) || position < 0 || position > 1) throw new Error('Revisa la posición de la puerta.');
      const half = widthMm / distance(wall.from, wall.to) / 2;
      return { ...aperture, widthMm, position: Math.min(1 - half, Math.max(half, position)),
        ...(edit.swing ? { swing: edit.swing } : {}), ...(edit.hinge ? { hinge: edit.hinge } : {}) };
    }),
  })) };
  if (found.size !== edits.size) throw new Error('Una puerta revisada ya no existe. Recarga la revisión.');
  for (const wall of walls.values()) {
    const apertures = result.zones.flatMap(zone => zone.apertures).filter(aperture => aperture.wallId === wall.id);
    const sorted = [...new Map(apertures.map(aperture => [aperture.id, aperture])).values()]
      .sort((a, b) => a.position - b.position);
    const length = distance(wall.from, wall.to);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!, b = sorted[i]!;
      if ((b.position - a.position) * length < (a.widthMm + b.widthMm) / 2 - 1)
        throw new Error('La puerta se solapa con otro hueco. Reduce su ancho o cambia su posición.');
    }
  }
  return result;
}

/** Conserva únicamente diferencias respecto a la reconstrucción anterior a la revisión manual. */
export function reviewedWallOverrides(base: Plano2dPayload, edited: Plano2dPayload): PlanWallOverride[] {
  const source = new Map(base.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const)));
  return [...new Map(edited.zones.flatMap(zone => zone.walls.map(wall => [wall.id, wall] as const))).values()]
    .filter(wall => { const before = source.get(wall.id); return before && (distance(before.from, wall.from) > .01
      || distance(before.to, wall.to) > .01 || before.thicknessMm !== wall.thicknessMm); })
    .map(wall => ({ wallId: wall.id, from: wall.from, to: wall.to, thicknessMm: wall.thicknessMm }));
}
