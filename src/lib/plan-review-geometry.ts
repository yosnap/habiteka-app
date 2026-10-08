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
  // Los contornos y cotas van por la cara del muro, a medio grosor del vértice:
  // acompañan al vértice movido más cercano dentro de ese margen.
  const halfAt = new Map<string, number>();
  for (const wall of walls.values()) for (const end of [wall.from, wall.to]) {
    const key = pointKey(end);
    halfAt.set(key, Math.max(halfAt.get(key) ?? 0, wall.thicknessMm / 2));
  }
  const shifts = [...moved].map(([key, after]) => {
    const [x, y] = key.split(',').map(Number) as [number, number];
    return { x, y, dx: after.x - x, dy: after.y - y, reach: (halfAt.get(key) ?? 0) + 5 };
  });
  const moveFace = (point: PlanPoint) => {
    const exact = moved.get(pointKey(point));
    if (exact) return exact;
    const near = shifts.filter(item => Math.abs(point.x - item.x) <= item.reach && Math.abs(point.y - item.y) <= item.reach)
      .sort((a, b) => Math.hypot(point.x - a.x, point.y - a.y) - Math.hypot(point.x - b.x, point.y - b.y))[0];
    return near ? { x: point.x + near.dx, y: point.y + near.dy } : point;
  };
  const result = { ...plano, zones: plano.zones.map(zone => ({ ...zone,
    outline: zone.outline.map(moveFace),
    dimensions: zone.dimensions.map(dimension => ({ ...dimension, from: moveFace(dimension.from), to: moveFace(dimension.to) })),
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

/**
 * Estira una estancia hasta `sizeMm` moviendo su lado derecho (`x`) o inferior
 * (`y`). Se desplazan juntos el eje de ese muro, las caras de las estancias a
 * ambos lados y los extremos de los muros que llegan a él, así que la estancia
 * vecina cede o gana lo mismo.
 */
export function resizeZoneSide(plano: Plano2dPayload, zoneId: string, axis: 'x' | 'y', sizeMm: number): Plano2dPayload {
  const zone = plano.zones.find(item => item.id === zoneId);
  if (!zone || zone.outline.length < 3 || !Number.isFinite(sizeMm)) return plano;
  const other = axis === 'x' ? 'y' : 'x';
  const along = zone.outline.map(point => point[axis]);
  const faceMin = Math.min(...along), faceMax = Math.max(...along);
  const delta = Math.round(sizeMm - (faceMax - faceMin));
  if (delta === 0 || sizeMm < 300) return plano;
  const across = zone.outline.map(point => point[other]);
  let lo = Math.min(...across), hi = Math.max(...across);
  const walls = [...new Map(plano.zones.flatMap(item => item.walls.map(wall => [wall.id, wall] as const))).values()];
  const onLine = (wall: (typeof walls)[number], line: number, tol: number) =>
    Math.abs(wall.from[axis] - line) <= tol && Math.abs(wall.to[axis] - line) <= tol;
  // El muro del lado que se mueve: el paralelo más cercano a su cara que la recorre. Puede
  // pertenecer a la estancia vecina, así que se busca entre todos los muros.
  const overlaps = (wall: (typeof walls)[number]) => Math.max(wall.from[other], wall.to[other]) > lo
    && Math.min(wall.from[other], wall.to[other]) < hi;
  const side = walls.filter(wall => onLine(wall, faceMax, wall.thicknessMm / 2 + 5) && overlaps(wall))
    .sort((a, b) => Math.abs(a.from[axis] - faceMax) - Math.abs(b.from[axis] - faceMax))[0];
  // Sin muro en ese lado (abierto o sin leer) no hay nada que mover: solo se cambiaría el contorno.
  if (!side) return plano;
  const line = side.from[axis];
  const tol = side.thicknessMm / 2 + 5;
  // Un muro continuo que sigue más allá de la estancia se mueve entero.
  for (let changed = true; changed;) {
    changed = false;
    for (const wall of walls) {
      if (!onLine(wall, line, tol)) continue;
      const a = Math.min(wall.from[other], wall.to[other]), b = Math.max(wall.from[other], wall.to[other]);
      if (b >= lo - tol && a <= hi + tol && (a < lo || b > hi)) { lo = Math.min(lo, a); hi = Math.max(hi, b); changed = true; }
    }
  }
  const shift = (point: PlanPoint): PlanPoint => Math.abs(point[axis] - line) <= tol
    && point[other] >= lo - tol && point[other] <= hi + tol ? { ...point, [axis]: point[axis] + delta } : point;
  return { ...plano, zones: plano.zones.map(item => ({ ...item,
    outline: item.outline.map(shift),
    dimensions: item.dimensions.map(dimension => ({ ...dimension, from: shift(dimension.from), to: shift(dimension.to) })),
    walls: item.walls.map(wall => ({ ...wall, from: shift(wall.from), to: shift(wall.to) })),
  })) };
}
