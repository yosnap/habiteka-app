import { isLegacyBoundary, planObjects } from '@/lib/editor-document/boundary-types';
import { isBoundaryJoint } from './boundary-junction';
import { isKitchenJoint } from '@/lib/editor-document/kitchen-run-volumes';
import { alignPoints, footprintAnchors } from './magnetic-alignment';
import type { Column, EditorDocument, Point, Furniture, Ramp, Stair } from '@/lib/editor-document/schema';
import { footprint, localToWorld, objectCenter } from '@/lib/editor-document/spatial-properties';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { wallMeshes } from './scene/wall-meshes';
import { stairMeshes } from './scene/stair-meshes';
import { wallPath } from '@/lib/editor-document/wall-path';
import { curvedWallMeshes } from './scene/curved-wall-meshes';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { placeStairAtRampArrival, stairRampGap } from '@/lib/editor-document/stair-landing-placement';
import { snapToAlignmentGuides } from './alignment-guides';
import { placeLandingAtHosts } from '@/lib/editor-document/landing-hosts';
import { alignBackToWall, alignKitchenRunToWall, dockToWindow, isWindowCovering } from './wall-back-alignment';
import { elementName } from '@/lib/editor-document/element-classification';
import { restOnHost } from '@/lib/editor-document/object-host-rest';
import { isBoundary } from '@/lib/editor-document/boundary-types';
import { isKitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { landingHugsWallEnd } from '@/lib/editor-document/landing-wall-corner';
import { doorSweepSolids } from './door-sweep-solids';

interface Solid { gate?: boolean; id: string; polygon: Point[]; bottom: number; top: number }
// Imported geometries often retain sub-millimetre rotations; their coplanar contacts are not collisions.
const CONTACT_EPSILON_MM = 1;
const boundsCache = new WeakMap<Solid, { minX: number; maxX: number; minY: number; maxY: number }>();
function bounds(solid: Solid) {
  let value = boundsCache.get(solid);
  if (!value) { value = { minX: Math.min(...solid.polygon.map((p) => p.x)), maxX: Math.max(...solid.polygon.map((p) => p.x)),
    minY: Math.min(...solid.polygon.map((p) => p.y)), maxY: Math.max(...solid.polygon.map((p) => p.y)) }; boundsCache.set(solid, value); }
  return value;
}
// La huella vive en `spatial-properties` (pura, sin lienzo); aquí solo se reexporta
// para no tocar a quien ya la importaba desde la colocación.
export { footprint };
function isColumn(item: Furniture | Stair | Ramp | Column): item is Column {
  return item.catalogId === 'builtin:column-rectangular' && !('kind' in item);
}
function isStair(item: Furniture | Stair | Ramp | Column): item is Stair {
  return 'stepCount' in item;
}
/** Separating-axis test: contact is allowed, positive penetration is not. */
function penetration(a: Solid, b: Solid): number {
  let depth = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  if (depth <= CONTACT_EPSILON_MM) return 0;
  const ab = bounds(a), bb = bounds(b);
  if (ab.maxX <= bb.minX + CONTACT_EPSILON_MM || bb.maxX <= ab.minX + CONTACT_EPSILON_MM
    || ab.maxY <= bb.minY + CONTACT_EPSILON_MM || bb.maxY <= ab.minY + CONTACT_EPSILON_MM) return 0;
  for (const polygon of [a.polygon, b.polygon]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!, length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length < .001) continue;
    const nx = -(q.y - p.y) / length, ny = (q.x - p.x) / length;
    const project = (points: Point[]) => points.map((v) => v.x * nx + v.y * ny);
    const ap = project(a.polygon), bp = project(b.polygon);
    const overlap = Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp));
    if (overlap <= CONTACT_EPSILON_MM) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}
function objectSolids(item: Furniture | Stair | Ramp | Column): Solid[] {
  if ('stepCount' in item) return stairMeshes(item).filter((b) => b.role !== 'rail').map((box) => {
    const widthMm = box.size[0] * 1000, depthMm = box.size[2] * 1000, rotation = -box.rotation * 180 / Math.PI;
    const offset = objectCenter({ x: 0, y: 0, widthMm, depthMm, rotation });
    return { id: item.id, polygon: footprint({ x: box.position[0] * 1000 - offset.x, y: box.position[2] * 1000 - offset.y, widthMm, depthMm, rotation }),
      bottom: (box.position[1] - box.size[1] / 2) * 1000, top: (box.position[1] + box.size[1] / 2) * 1000 };
  });
  if ('riseMm' in item) {
    const landing = isRampLanding(item);
    return [{ id: item.id, polygon: footprint(item), bottom: landing ? 0 : item.elevationMm,
      top: landing ? Math.max(item.elevationMm, 20) : item.elevationMm + item.riseMm }];
  }
  if (isColumn(item)) {
    return [{ id: item.id, polygon: footprint(item), bottom: item.elevationMm, top: item.elevationMm + item.heightMm }];
  }
  const furniture = item as Furniture;
  // Surface markings and grates can share the ground with cars and furnishings.
  if (/^habiteka:outdoor:(parking|camino|drenaje|sumidero|riego-goteo)$/.test(furniture.catalogId ?? '') &&
    furnitureVolumes(furniture).every((v) => v.top <= 100)) return [];
  return furnitureVolumes(furniture).map((volume) => ({ id: furniture.id, gate: volume.part === 'gate', bottom: volume.bottom, top: volume.top,
    polygon: volume.shape === 'cylinder' ? Array.from({ length: 24 }, (_, i) => localToWorld(furniture, {
      x: volume.x + volume.widthMm / 2 * (1 + Math.cos(i * Math.PI / 12)),
      y: volume.y + volume.depthMm / 2 * (1 + Math.sin(i * Math.PI / 12)),
    })) : footprint({ ...furniture, ...volume, rotation: furniture.rotation + (volume.rotation ?? 0), ...localToWorld(furniture, volume) }) }));
}
function walls(doc: EditorDocument): Solid[] {
  const visibleWalls = doc.walls.filter((wall) => !wall.hidden);
  const curved = visibleWalls.flatMap((w) => curvedWallMeshes(doc, w)).flatMap((strip) => {
    const n = strip.points.length, half = n / 2;
    return strip.points.slice(0, half - 1).map((_, i) => ({ id: strip.sourceEntityId,
      polygon: [strip.points[i]!, strip.points[i + 1]!, strip.points[n - 2 - i]!, strip.points[n - 1 - i]!].map((p) => ({ x: p.x * 1000, y: p.y * 1000 })),
      bottom: strip.elevation * 1000, top: (strip.elevation + strip.height) * 1000 }));
  });
  return [...curved, ...visibleWalls.filter((w) => !w.curveHeightMm).flatMap((w) => wallMeshes(doc, w)).map((box) => {
    const widthMm = box.size[0] * 1000, depthMm = box.size[2] * 1000, rotation = -box.rotation * 180 / Math.PI;
    const offset = objectCenter({ x: 0, y: 0, widthMm, depthMm, rotation });
    return { id: box.sourceEntityId, polygon: footprint({ x: box.position[0] * 1000 - offset.x, y: box.position[2] * 1000 - offset.y, widthMm, depthMm, rotation }),
      bottom: (box.position[1] - box.size[1] / 2) * 1000, top: (box.position[1] + box.size[1] / 2) * 1000 };
  })];
}

/** Al engrosar un muro, desplaza cada mueble apoyado en su cara solo lo necesario para conservar el contacto. */
export function relieveFurnitureForThickerWalls(previous: EditorDocument, candidate: EditorDocument): EditorDocument {
  const thicker = candidate.walls.filter((wall) => {
    const old = previous.walls.find((item) => item.id === wall.id);
    return old && !wall.hidden && wall.thicknessMm > old.thicknessMm + .1;
  });
  if (!thicker.length || (!candidate.furniture.length && !candidate.kitchenRuns?.length)) return candidate;
  const oldSolids = walls(previous), newSolids = walls(candidate);
  const result = structuredClone(candidate);
  const movable = [...result.furniture, ...(result.kitchenRuns ?? [])].filter((item) =>
    !item.hostId && !isBoundary(item) && !isLegacyBoundary(item));
  const previousObjects = new Map([...previous.furniture, ...(previous.kitchenRuns ?? [])].map((item) => [item.id, item]));
  const depth = (item: Furniture, solids: Solid[]) => Math.max(0, ...objectSolids(item).flatMap((a) => solids.map((b) => penetration(a, b))));

  // Un tabique compartido puede tocar muebles a ambos lados; la orientación de cada uno decide hacia qué cara sale.
  for (let pass = 0; pass < Math.min(4, thicker.length + 1); pass++) {
    let moved = false;
    for (const wall of thicker) {
      const target = newSolids.filter((solid) => solid.id === wall.id);
      const oldTarget = oldSolids.filter((solid) => solid.id === wall.id);
      const path = wallPath(result, wall);
      for (const item of movable) {
        const original = previousObjects.get(item.id);
        if (!original) continue;
        const allowed = depth(original, oldTarget) + .1;
        if (depth(item, target) <= allowed) continue;
        const center = objectCenter(item), t = path.project(center), onWall = path.at(t), tangent = path.tangent(t);
        const signed = (center.x - onWall.x) * -tangent.y + (center.y - onWall.y) * tangent.x;
        const normal = { x: -tangent.y * (signed >= 0 ? 1 : -1), y: tangent.x * (signed >= 0 ? 1 : -1) };
        const shifted = (mm: number): Furniture => ({ ...item, x: item.x + normal.x * mm, y: item.y + normal.y * mm });
        const maxShift = Math.min(1500, Math.max(200, wall.thicknessMm - (previous.walls.find((old) => old.id === wall.id)?.thicknessMm ?? 0) + Math.max(item.widthMm, item.depthMm)));
        if (depth(shifted(maxShift), target) > allowed) continue;
        let low = 0, high = maxShift;
        for (let i = 0; i < 18; i++) {
          const middle = (low + high) / 2;
          if (depth(shifted(middle), target) > allowed) low = middle; else high = middle;
        }
        item.x += normal.x * (high + .1);
        item.y += normal.y * (high + .1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Los objetos colocados encima conservan su posición relativa con la mesa, armario o módulo que los soporta.
  const byId = new Map([...result.furniture, ...(result.kitchenRuns ?? [])].map((item) => [item.id, item]));
  const adjusted = new Set<string>(), visiting = new Set<string>();
  const followHost = (item: Furniture) => {
    if (adjusted.has(item.id) || visiting.has(item.id)) return;
    visiting.add(item.id);
    const host = item.hostId && byId.get(item.hostId), oldHost = item.hostId && previousObjects.get(item.hostId);
    if (host && oldHost) {
      followHost(host);
      item.x += host.x - oldHost.x;
      item.y += host.y - oldHost.y;
    }
    visiting.delete(item.id);
    adjusted.add(item.id);
  };
  for (const item of result.furniture) if (item.hostId) followHost(item);
  return result;
}
/** Pares de sólidos que se penetran y su profundidad; útil para diagnosticar bloqueos de colocación. */
export function collisions(doc: EditorDocument): Map<string, number> {
  const objects = [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].flatMap(objectSolids);
  const wallSolids = [...walls(doc), ...doorSweepSolids(doc)];
  const result = new Map<string, number>();
  const boundaryItems = new Map(planObjects(doc).map((item) => [item.id, item]));
  objects.forEach((a, index) => {
    for (const b of [...objects.slice(index + 1), ...wallSolids]) {
      if (a.id === b.id) continue;
      const first = boundaryItems.get(a.id), second = boundaryItems.get(b.id);
      if (!a.gate && !b.gate && first && second && (isBoundaryJoint(first, second) || isKitchenJoint(first, second))) continue;
      if (first && second && (first.hostId === second.id || second.hostId === first.id)) continue;
      // El grifo o los aparatos de un tramo de cocina pueden asomar delante de un estor colgado de la ventana: no es choque.
      if (first && second && ((isKitchenRun(first) && isWindowCovering(second)) || (isWindowCovering(first) && isKitchenRun(second)))) continue;
      const depth = penetration(a, b);
      if (depth > .1) { const key = JSON.stringify([a.id, b.id].sort()); result.set(key, Math.max(depth, result.get(key) ?? 0)); }
    }
  });
  return result;
}
function snapOriginToWallEndpoint(doc: EditorDocument, item: Furniture | Stair | Ramp | Column, tolerance: number) {
  let closest: Point | null = null, distance = tolerance;
  for (const wall of doc.walls.filter((wall) => !wall.hidden)) {
    const path = wallPath(doc, wall);
    for (const point of [path.at(0), path.at(path.length)]) {
      const next = Math.hypot(item.x - point.x, item.y - point.y);
      if (next <= distance) { closest = point; distance = next; }
    }
  }
  return closest ? { ...item, x: closest.x, y: closest.y } : item;
}
/** Nombre legible de cada sólido en conflicto, para que el aviso diga con qué choca el elemento. */
function collisionLabel(doc: EditorDocument, id: string): string {
  const object = planObjects(doc).find((item) => item.id === id);
  if (object) return `«${elementName(object)}»`;
  const wall = doc.walls.find((item) => item.id === id);
  if (wall) return wall.name?.trim() ? `la pared «${wall.name.trim()}»` : 'la pared';
  const opening = doc.openings.find((item) => item.id === id);
  if (opening) return opening.name?.trim() ? `la puerta «${opening.name.trim()}»` : 'la puerta';
  const column = doc.columns?.find((item) => item.id === id);
  if (column) return column.name?.trim() ? `la columna «${column.name.trim()}»` : 'la columna';
  const stair = doc.stairs?.find((item) => item.id === id);
  if (stair) return stair.name?.trim() ? `la escalera «${stair.name.trim()}»` : 'la escalera';
  const ramp = doc.ramps?.find((item) => item.id === id);
  if (ramp) return ramp.name?.trim() ? `«${ramp.name.trim()}»` : isRampLanding(ramp) ? 'el descansillo' : 'la rampa';
  return 'otro elemento';
}
/** Legacy intersections remain repairable; edits cannot introduce or deepen one. */
export function assertSpatialPlacement(previous: EditorDocument, candidate: EditorDocument): void {
  const before = collisions(previous), after = collisions(candidate);
  const columnIds = new Set([...(previous.columns ?? []), ...(candidate.columns ?? [])].map((column) => column.id));
  const structuralIds = new Set([
    ...previous.walls, ...candidate.walls,
    ...(previous.stairs ?? []), ...(candidate.stairs ?? []),
    ...(previous.ramps ?? []), ...(candidate.ramps ?? []),
  ].map((item) => item.id));
  // Un cerramiento (valla, cerca, seto) admite columnas embebidas igual que un muro; entre cerramientos sí se detectan cruces.
  // Un pilar que cae sobre un mueble de cocina tampoco es colisión: el mueble se recorta a su alrededor como en obra.
  const boundaryIds = new Set([...(previous.boundaries ?? []), ...(candidate.boundaries ?? []), ...(previous.kitchenRuns ?? []), ...(candidate.kitchenRuns ?? [])].map((item) => item.id));
  // Muretes y cerramientos bajos (≤ 1,50 m) pueden apoyarse en descansillos, escaleras y rampas.
  const guardWallIds = new Set([
    ...[...previous.walls, ...candidate.walls].filter((wall) => (wall.heightMm ?? 2700) <= 1500),
    ...[...(previous.boundaries ?? []), ...(candidate.boundaries ?? [])].filter((boundary) => boundary.heightMm <= 1500),
  ].map((item) => item.id));
  const landings = new Map((candidate.ramps ?? []).filter(isRampLanding).map((item) => [item.id, item]));
  const wallsById = new Map(candidate.walls.map((wall) => [wall.id, wall]));
  for (const [key, depth] of after) {
    const [first, second] = JSON.parse(key) as [string, string];
    // Un descansillo puede abrazar la esquina de un muro (su extremo), igual que se empotra en una columna.
    const landing = landings.get(first) ?? landings.get(second), wall = wallsById.get(first) ?? wallsById.get(second);
    if (landing && wall && landingHugsWallEnd(candidate, landing, wall)) continue;
    // A column is structural: it can be embedded in a wall, stair or ramp
    // (including a landing), while furniture and another column stay blocked.
    if ((columnIds.has(first) && (structuralIds.has(second) || boundaryIds.has(second))) || (columnIds.has(second) && (structuralIds.has(first) || boundaryIds.has(first)))) continue;
    // Los muretes de protección pueden llegar a 1,50 m y apoyarse en descansillos/escaleras.
    if ((guardWallIds.has(first) && structuralIds.has(second)) || (guardWallIds.has(second) && structuralIds.has(first))) continue;
    if (depth > (before.get(key) ?? 0) + .1) {
      const doorId = candidate.openings.find((opening) => opening.kind === 'puerta' &&
        (opening.id === first || opening.id === second))?.id;
      if (doorId) {
        const obstacleId = doorId === first ? second : first;
        throw new Error(`El giro de ${collisionLabel(candidate, doorId)} choca con ${collisionLabel(candidate, obstacleId)}. Cambia el giro o mueve el obstáculo.`);
      }
      throw new Error(`${collisionLabel(candidate, first)} atraviesa ${collisionLabel(candidate, second)} (${Math.max(1, Math.round(depth / 10))} cm). Ajusta posición, tamaño o elevación.`);
    }
  }
}
/** Insert/copy beside the requested location without overlapping existing solids. */
export function placeNewObject(previous: EditorDocument, candidate: EditorDocument, id: string): EditorDocument {
  const item = planObjects(candidate).find((f) => f.id === id) ?? candidate.stairs?.find((s) => s.id === id) ?? candidate.ramps?.find((r) => r.id === id) ?? candidate.columns?.find((c) => c.id === id);
  if (!item) throw new Error('Elemento no encontrado');
  const occupied = [...walls(previous), ...doorSweepSolids(previous), ...planObjects(previous).flatMap(objectSolids),
    ...(previous.stairs ?? []).flatMap(objectSolids), ...(previous.ramps ?? []).flatMap(objectSolids), ...(previous.columns ?? []).flatMap(objectSolids)];
  for (let ring = 0; ring <= 32; ring++) for (let direction = 0; direction < (ring ? 8 : 1); direction++) {
    const angle = direction * Math.PI / 4;
    const placed = { ...item, x: item.x + Math.cos(angle) * ring * 250, y: item.y + Math.sin(angle) * ring * 250 };
    if (objectSolids(placed).some((a) => occupied.some((b) => penetration(a, b) > .1))) continue;
    return { ...candidate, ...(candidate.boundaries ? { boundaries: candidate.boundaries.map((b) => b.id === id ? placed as typeof b : b) } : {}),
      ...(candidate.kitchenRuns ? { kitchenRuns: candidate.kitchenRuns.map((r) => r.id === id ? placed as typeof r : r) } : {}), furniture: candidate.furniture.map((f) => f.id === id ? placed as Furniture : f),
      stairs: candidate.stairs?.map((s) => s.id === id ? placed as Stair : s),
      ...(candidate.columns ? { columns: candidate.columns.map((c) => c.id === id ? placed as Column : c) } : {}),
      ...(candidate.ramps ? { ramps: candidate.ramps.map((r) => r.id === id ? placed as Ramp : r) } : {}) };
  }
  throw new Error('No hay espacio libre cercano. Libera espacio antes de añadir el elemento.');
}
/** Translate to the closest wall face using the complete oriented footprint. */
export function snapObject(doc: EditorDocument, item: Furniture | Stair | Ramp | Column, scale: number, enabled: boolean,
  options: { preserveRotation?: boolean } = {}) {
  if (!enabled) return item;
  // El imán manda: la rejilla de 10 cm solo actúa en el eje sin referencia, y después el objeto puede afinar a una cara.
  const magnet = alignPoints(doc, footprintAnchors(item), scale, enabled, [item.id]);
  let result = { ...item, x: magnet.snapped.x ? item.x + magnet.delta.x : Math.round(item.x / 100) * 100,
    y: magnet.snapped.y ? item.y + magnet.delta.y : Math.round(item.y / 100) * 100 };
  const landing = 'riseMm' in result ? result as Ramp : null;
  const endpointTolerance = 12 / Math.max(.001, scale), faceTolerance = Math.max(150, 24 / Math.max(.001, scale));
  if (isColumn(result)) {
    // La columna conserva el eje estructural de un muro, pero también puede
    // alinearse con los bordes de cualquier otro elemento cuando está libre.
    const wallAxis = snapColumnToWallAxis(doc, result, faceTolerance);
    if (wallAxis.x !== result.x || wallAxis.y !== result.y) return wallAxis;
    // El centro del pilar se imanta a esquinas y bordes de descansillos, escaleras y objetos (queda medio fuera),
    // como el resto de elementos; solo si no hay referencia cerca se alinea por sus bordes.
    const centred = alignPoints(doc, [objectCenter(result)], scale, enabled, [item.id]);
    if (centred.guides.length) return { ...result, x: result.x + centred.delta.x, y: result.y + centred.delta.y };
    const edges = snapToAlignmentGuides(doc, result, faceTolerance, { includeWallEdges: false }) as Column;
    if (edges.x !== result.x || edges.y !== result.y) return edges;
    const axes = alignPoints(doc, footprintAnchors(result), scale, enabled, [item.id]);
    return { ...result, x: result.x + axes.delta.x, y: result.y + axes.delta.y };
  }
  if (landing && isRampLanding(landing)) {
    // Llegadas combinadas (rampa + escalera contiguas) se tratan como una sola: el descansillo cubre las dos.
    const center = objectCenter(landing);
    const attached = placeLandingAtHosts(doc, landing, Math.max(500, 40 / scale), (placed) => {
      const targetCenter = objectCenter(placed); return Math.hypot(center.x - targetCenter.x, center.y - targetCenter.y);
    });
    if (attached) return alignAttachedLandingToWall(doc, attached, faceTolerance);
  }
  if (isStair(result)) {
    const stair = result as Stair;
    const attached = doc.ramps?.filter((ramp) => !isRampLanding(ramp)).map((ramp) => {
      const target = placeStairAtRampArrival(stair, ramp);
      return { target, gap: stairRampGap(stair, ramp) };
    }).filter((candidate) => candidate.gap <= Math.max(500, 40 / scale)).sort((a, b) => a.gap - b.gap)[0];
    if (attached) return attached.target;
  }
  result = snapOriginToWallEndpoint(doc, result, endpointTolerance);
  const aligned = alignPoints(doc, footprintAnchors(result), scale, enabled, [item.id]);
  result = { ...result, x: result.x + aligned.delta.x, y: result.y + aligned.delta.y };
  const furniture = 'kind' in result && !('stepCount' in result) && !isBoundary(result) && !isKitchenRun(result);
  // Durante un arrastre la orientación elegida por el usuario tiene prioridad sobre el giro automático al muro.
  if (furniture) {
    const positioned = options.preserveRotation ? result as Furniture : alignBackToWall(doc, result as Furniture, faceTolerance);
    result = restOnHost(doc, dockToWindow(doc, positioned, faceTolerance), { alignRotation: !options.preserveRotation });
  }
  // Un tramo de cocina se endereza contra un muro inclinado para no dejar una cuña de holgura entre trasera y pared.
  if ('kind' in result && !('stepCount' in result) && isKitchenRun(result) && !options.preserveRotation)
    result = alignKitchenRunToWall(doc, result, faceTolerance);
  // La cara física tiene prioridad: alinear otro eje no debe separar el objeto de la pared.
  return snapToWallFace(doc, result, faceTolerance);
}

/** Structural columns snap to the wall centreline, not to an exterior face. */
function snapColumnToWallAxis(doc: EditorDocument, column: Column, tolerance: number): Column {
  const center = objectCenter(column);
  let closest: Point | null = null, gap = tolerance;
  for (const wall of doc.walls.filter((wall) => !wall.hidden)) {
    const path = wallPath(doc, wall), point = path.at(path.project(center));
    const nextGap = Math.hypot(center.x - point.x, center.y - point.y);
    if (nextGap <= gap) { closest = point; gap = nextGap; }
  }
  return closest ? { ...column, x: column.x + closest.x - center.x, y: column.y + closest.y - center.y } : column;
}

/** A landing may align laterally to a wall, never move away from the ramp edge it joined. */
function alignAttachedLandingToWall(doc: EditorDocument, landing: Ramp, tolerance: number): Ramp {
  const wallAligned = snapToWallFace(doc, landing, tolerance), delta = { x: wallAligned.x - landing.x, y: wallAligned.y - landing.y };
  const radians = landing.rotation * Math.PI / 180, axis = { x: Math.cos(radians), y: Math.sin(radians) };
  const lateralMm = delta.x * axis.x + delta.y * axis.y;
  return { ...landing, x: landing.x + axis.x * lateralMm, y: landing.y + axis.y * lateralMm };
}

/** Aligns the nearest footprint edge to a physical wall face; repeated passes settle corners. */
function snapToWallFace(doc: EditorDocument, item: Furniture | Stair | Ramp | Column, tolerance: number) {
  let result = item;
  for (let pass = 0; pass < 2; pass++) {
    let best: { gap: number; delta: Point } | null = null;
    const corners = footprint(result), center = objectCenter(result);
    for (const wall of doc.walls.filter((wall) => !wall.hidden)) {
      const path = wallPath(doc, wall), t = wall.curveHeightMm ? path.project(center) : 0;
      const a = path.at(t), direction = path.tangent(t), length = path.length, ux = direction.x, uy = direction.y;
      const longitudinal = corners.map((p) => (p.x - a.x) * ux + (p.y - a.y) * uy);
      if (Math.max(...longitudinal) < 0 || Math.min(...longitudinal) > length) continue;
      const side = ((center.x - a.x) * -uy + (center.y - a.y) * ux) >= 0 ? 1 : -1;
      const distances = corners.map((p) => ((p.x - a.x) * -uy + (p.y - a.y) * ux) * side);
      const gap = Math.min(...distances) - wall.thicknessMm / 2;
      if (Math.abs(gap) <= tolerance && Math.abs(gap) > .01 && (!best || Math.abs(gap) < Math.abs(best.gap)))
        best = { gap, delta: { x: uy * gap * side, y: -ux * gap * side } };
    }
    if (best) result = { ...result, x: result.x + best.delta.x, y: result.y + best.delta.y };
  }
  return result;
}
