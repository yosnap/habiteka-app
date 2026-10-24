import { emptyEditorDocument, type EditorDocument, type Point } from './schema';
import { ELEMENT_COLLECTIONS, elementIds, expandElementGroups } from './element-groups';
import { parseEditorDocument } from './validation';
import { upgradeLightingDocument } from './lighting-migration';
import { deriveRoomsSafe } from './rooms';
import { constructionGroup } from './element-classification';
import { packageBounds, translatePackage } from './package-geometry';

export type PackageCategory = 'furniture' | 'construction' | 'mixed';
export interface ElementPackage { id: string; name: string; category: PackageCategory; document: EditorDocument }

/** Añade los soportes necesarios, sin copiar el resto del proyecto ni sus datos privados. */
export function extractElementPackage(source: EditorDocument, selection: string[]): EditorDocument {
  const doc = upgradeLightingDocument(source), ids = new Set(expandElementGroups(doc, selection));
  const rooms = deriveRoomsSafe(doc);
  const add = (id?: string) => { if (id) ids.add(id); };
  let size = -1;
  while (size !== ids.size) {
    size = ids.size;
    for (const room of rooms) if (ids.has(room.id)) room.wallIds.forEach(add);
    for (const opening of doc.openings) {
      if (ids.has(opening.id)) add(opening.wallId);
      if (ids.has(opening.wallId)) add(opening.id);
      if (ids.has(opening.id)) add(opening.sourceRampId);
    }
    for (const light of doc.luminaires ?? []) if (ids.has(light.id)) add(light.ceilingId);
    for (const ceiling of doc.ceilings ?? []) if (ids.has(ceiling.id)) add(ceiling.roomId);
    for (const strip of doc.lightStrips ?? []) if (ids.has(strip.id)) { add(strip.ceilingId); add(strip.kitchenRunId); }
    for (const item of doc.furniture) if (ids.has(item.id) && item.hostId) {
      if (![...doc.furniture, ...(doc.kitchenRuns ?? []), ...(doc.boundaries ?? [])].some(host => host.id === item.hostId))
        throw new Error('Una pieza tiene un soporte que ya no existe. Corrige su apoyo antes de guardar el paquete.');
      add(item.hostId);
    }
    for (const boundary of doc.boundaries ?? []) if (boundary.construction.gates.some(gate => ids.has(gate.id))) add(boundary.id);
    for (const run of doc.kitchenRuns ?? []) if (run.kitchen.slots.some(slot => ids.has(slot.id))) add(run.id);
  }
  const next = upgradeLightingDocument(emptyEditorDocument());
  for (const key of ELEMENT_COLLECTIONS) Object.assign(next, { [key]: structuredClone((doc[key] ?? []).filter(item => ids.has(item.id))) });
  next.vertices = doc.vertices.filter(vertex => next.walls.some(wall => wall.startVertexId === vertex.id || wall.endVertexId === vertex.id));
  const completeRooms = rooms.filter(room => room.wallIds.every(id => ids.has(id)));
  next.floorFinishes = structuredClone(doc.floorFinishes?.filter(finish => completeRooms.some(room => room.id === finish.roomId)) ?? []);
  // Los recorridos pertenecen a los diseños del proyecto y no se transportan con los muebles.
  if (next.walkthroughs?.length) throw new Error('Los recorridos pertenecen al proyecto y no se pueden guardar en un paquete.');
  const count = elementIds(next).size;
  if (!count || count > 300) throw new Error('Un paquete debe contener entre 1 y 300 elementos.');
  const bounds = packageBounds(next);
  return parseEditorDocument(translatePackage(next, { x: -bounds.minX, y: -bounds.minY }));
}

export function packageCategory(doc: EditorDocument): PackageCategory {
  const furniture = doc.furniture.some(item => !constructionGroup(item));
  const construction = doc.furniture.some(item => Boolean(constructionGroup(item))) ||
    ELEMENT_COLLECTIONS.some(key => key !== 'furniture' && (doc[key]?.length ?? 0) > 0);
  return furniture && construction ? 'mixed' : furniture ? 'furniture' : 'construction';
}

export function validatePackageDocument(value: unknown): EditorDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Documento de paquete inválido.');
  if (new TextEncoder().encode(JSON.stringify(value)).length > 1_000_000) throw new Error('El paquete supera el tamaño permitido (1 MB).');
  const doc = parseEditorDocument(value);
  if (doc.levels || doc.geographicSite || doc.renderBackdrop || doc.exteriorRoof || doc.importReview || doc.comments?.length || doc.walkthroughs?.length)
    throw new Error('El paquete solo puede contener elementos del plano.');
  return extractElementPackage(doc, [...elementIds(doc)]);
}

export function insertElementPackage(source: EditorDocument, pack: Pick<ElementPackage, 'name' | 'document'>, center: Point) {
  const template = validatePackageDocument(pack.document), mapping = new Map<string, string>();
  // IDs de entidades y piezas internas. Las referencias de catálogo nunca se remapean.
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (typeof object.id === 'string') {
      const prefix = object.id.startsWith('outdoor:') ? 'outdoor:' : object.id.startsWith('hidden:') ? 'hidden:' : '';
      mapping.set(object.id, `${prefix}${crypto.randomUUID()}`);
    }
    Object.values(object).forEach(collect);
  };
  collect(template);
  for (const room of deriveRoomsSafe(template)) mapping.set(room.id,
    `room:${JSON.stringify(room.wallIds.map(id => mapping.get(id)!).sort())}`);
  const references = new Set(['id', 'startVertexId', 'endVertexId', 'wallId', 'hostId', 'ceilingId', 'kitchenRunId', 'roomId', 'sourceRampId']);
  const remap = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string' && references.has(key)) return mapping.get(value) ?? value;
    if (Array.isArray(value)) return value.map(item => remap(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, k)]));
    return value;
  };
  const bounds = packageBounds(template);
  const copy = translatePackage(remap(template) as EditorDocument, { x: center.x - bounds.width / 2, y: center.y - bounds.height / 2 });
  const next = upgradeLightingDocument(source);
  for (const key of [...ELEMENT_COLLECTIONS, 'vertices', 'floorFinishes'] as const)
    Object.assign(next, { [key]: [...(next[key] ?? []), ...(copy[key] ?? [])] });
  const ids = [...elementIds(copy)];
  if (ids.length > 1) next.elementGroups = [...(next.elementGroups ?? []), { id: crypto.randomUUID(), name: pack.name, elementIds: ids }];
  return { document: parseEditorDocument(next), ids };
}
