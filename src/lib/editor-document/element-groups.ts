import type { EditorDocument } from './schema';

/** Colecciones de entidades independientes que pueden formar conjuntos reutilizables. */
export const ELEMENT_COLLECTIONS = ['walls', 'openings', 'furniture', 'boundaries', 'kitchenRuns',
  'stairs', 'ramps', 'columns', 'labels', 'dimensions', 'terrainSurfaces', 'ceilings',
  'luminaires', 'lightStrips', 'lightZones', 'designZones', 'walkthroughs'] as const;

export function elementIds(doc: EditorDocument): Set<string> {
  return new Set(ELEMENT_COLLECTIONS.flatMap(key => (doc[key] ?? []).map(item => item.id)));
}

export function expandElementGroups(doc: EditorDocument, ids: string[]): string[] {
  const result = new Set(ids);
  for (const group of doc.elementGroups ?? []) {
    if (result.has(group.id) || group.elementIds.some(id => result.has(id))) {
      result.delete(group.id);
      group.elementIds.forEach(id => result.add(id));
    }
  }
  return [...result];
}

/** La eliminación de elementos puede disolver conjuntos; no conserva referencias huérfanas. */
export function pruneElementGroups(doc: EditorDocument): EditorDocument {
  if (!doc.elementGroups?.length) return doc;
  const available = elementIds(doc);
  return { ...doc, elementGroups: doc.elementGroups.map(group => ({ ...group,
    elementIds: group.elementIds.filter(id => available.has(id)),
  })).filter(group => group.elementIds.length > 1) };
}

export function groupElements(doc: EditorDocument, ids: string[], name: string): EditorDocument {
  const members = expandElementGroups(doc, ids), available = elementIds(doc);
  if (members.length < 2 || members.some(id => !available.has(id)))
    throw new Error('Selecciona al menos dos elementos del plano para agruparlos.');
  if (!name.trim() || name.trim().length > 100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
  return { ...doc, elementGroups: [...(doc.elementGroups ?? []).filter(group =>
    !group.elementIds.some(id => members.includes(id))),
  { id: crypto.randomUUID(), name: name.trim(), elementIds: members }] };
}

export function ungroupElements(doc: EditorDocument, ids: string[]): EditorDocument {
  return { ...doc, elementGroups: (doc.elementGroups ?? []).filter(group =>
    !ids.includes(group.id) && !group.elementIds.some(id => ids.includes(id))) };
}

export function assertElementOrganization(value: Record<string, unknown>): void {
  if (value.lockedElementIds !== undefined && (!Array.isArray(value.lockedElementIds) ||
    value.lockedElementIds.length > 10000 || value.lockedElementIds.some(id => typeof id !== 'string' || !id || id.length > 10000) ||
    new Set(value.lockedElementIds).size !== value.lockedElementIds.length)) throw new Error('Bloqueos de elementos inválidos.');
  if (value.elementGroups === undefined) return;
  if (!Array.isArray(value.elementGroups) || value.elementGroups.length > 1000) throw new Error('Grupos inválidos.');
  const used = new Set<string>(), groupIds = new Set<string>();
  const available = elementIds(value as unknown as EditorDocument);
  for (const group of value.elementGroups) {
    if (!group || typeof group !== 'object' || Object.keys(group).some(key => !['id', 'name', 'elementIds'].includes(key)) ||
      typeof group.id !== 'string' || !group.id || group.id.length > 300 || available.has(group.id) || groupIds.has(group.id) ||
      typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 ||
      !Array.isArray(group.elementIds) || group.elementIds.length < 2 || group.elementIds.length > 1000)
      throw new Error('Grupo inválido.');
    groupIds.add(group.id);
    for (const id of group.elementIds) {
      if (typeof id !== 'string' || !available.has(id) || used.has(id)) throw new Error('Un elemento solo puede pertenecer a un grupo.');
      used.add(id);
    }
  }
}
