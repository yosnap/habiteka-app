import type { EditorDocument, FloorFinish, Furniture, Opening, Wall } from './schema';
import { planObjects } from './boundary-types';
import { setOpeningConstruction, setWallConstruction, updateColumn } from './construction-commands';
import { updateFurniture } from './spatial-commands';
import { floorFinish, setFloorFinish } from './floor-finishes';

export type BulkCategory = 'wall' | 'opening' | 'object' | 'column' | 'room';

/** Categoría editable en bloque de un id de selección. */
export function bulkCategory(doc: EditorDocument, id: string): BulkCategory | undefined {
  if (id.startsWith('room:')) return 'room';
  if (doc.walls.some((w) => w.id === id)) return 'wall';
  if (doc.openings.some((o) => o.id === id)) return 'opening';
  if (planObjects(doc).some((o) => o.id === id)) return 'object';
  if (doc.columns?.some((c) => c.id === id)) return 'column';
  return undefined;
}

/** Ids de la selección que comparten categoría con el principal y pueden recibir el mismo cambio. */
export function bulkPeers(doc: EditorDocument, primaryId: string, selection: string[]): string[] {
  const category = bulkCategory(doc, primaryId);
  return category ? selection.filter((id) => id !== primaryId && bulkCategory(doc, id) === category) : [];
}

const WALL_KEYS = ['heightMm', 'baseElevationMm', 'materials', 'colors', 'thicknessMm'] as const;
const OPENING_KEYS = ['heightMm', 'elevationMm', 'openAngleDeg', 'hinge', 'swing', 'catalogId', 'widthMm'] as const;
const OBJECT_KEYS = ['widthMm', 'depthMm', 'heightMm', 'elevationMm', 'rotation', 'color', 'materialId', 'construction', 'kitchen'] as const;
const COLUMN_KEYS = ['widthMm', 'depthMm', 'heightMm', 'elevationMm', 'materialId', 'color'] as const;
const FINISH_KEYS = ['color', 'texture', 'tileSizeMm', 'rotation', 'elevationMm', 'slabThicknessMm'] as const;

function changedKeys<T extends object, K extends keyof T>(before: T | undefined, after: T | undefined, keys: readonly K[]): Partial<Pick<T, K>> {
  const patch: Partial<Pick<T, K>> = {};
  if (!before || !after) return patch;
  for (const key of keys) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) patch[key] = after[key];
  return patch;
}

/**
 * Repite en los `peerIds` el cambio que una edición hizo sobre el elemento principal. Se deduce comparando el
 * principal antes y después, así los campos del inspector no necesitan saber nada de la selección múltiple.
 * Las puertas de un cerramiento y los aparatos de una cocina nunca se copian a otro; los nombres tampoco.
 */
export function propagateToPeers(before: EditorDocument, after: EditorDocument, primaryId: string, peerIds: string[]): EditorDocument {
  if (!peerIds.length) return after;
  let doc = after;
  switch (bulkCategory(after, primaryId)) {
    case 'wall': {
      const patch = changedKeys(before.walls.find((w) => w.id === primaryId), after.walls.find((w) => w.id === primaryId), WALL_KEYS);
      if (!Object.keys(patch).length) return after;
      for (const id of peerIds) {
        const { thicknessMm, colors, ...construction } = patch;
        if (Object.keys(construction).length) doc = setWallConstruction(doc, id, construction as Pick<Wall, 'heightMm' | 'materials' | 'baseElevationMm'>);
        if (thicknessMm !== undefined || colors !== undefined) doc = { ...doc, walls: doc.walls.map((w) => w.id === id ? { ...w, ...(thicknessMm !== undefined ? { thicknessMm } : {}), ...(colors !== undefined ? { colors } : {}) } : w) };
      }
      return doc;
    }
    case 'opening': {
      const patch = changedKeys(before.openings.find((o) => o.id === primaryId), after.openings.find((o) => o.id === primaryId), OPENING_KEYS);
      if (!Object.keys(patch).length) return after;
      for (const id of peerIds) {
        const { widthMm, ...construction } = patch;
        if (Object.keys(construction).length) doc = setOpeningConstruction(doc, id, construction as Partial<Pick<Opening, 'heightMm' | 'elevationMm' | 'catalogId' | 'hinge' | 'swing' | 'openAngleDeg'>>);
        if (widthMm !== undefined) doc = { ...doc, openings: doc.openings.map((o) => o.id === id ? { ...o, widthMm } : o) };
      }
      return doc;
    }
    case 'object': {
      // Muebles y cerramientos comparten campos base; `materialId` y `construction` solo existen en algunos.
      const patch = changedKeys(planObjects(before).find((o) => o.id === primaryId) as Record<string, unknown> | undefined,
        planObjects(after).find((o) => o.id === primaryId) as Record<string, unknown> | undefined, OBJECT_KEYS as readonly string[]);
      if (!Object.keys(patch).length) return after;
      for (const id of peerIds) {
        const peer = planObjects(doc).find((o) => o.id === id) as (Furniture & { construction?: { gates: unknown[] }; kitchen?: { slots: unknown[] } }) | undefined;
        if (!peer) continue;
        const { construction, kitchen, ...rest } = patch as typeof patch & { construction?: { gates: unknown[] }; kitchen?: { slots: unknown[] } };
        const merged = { ...(construction && peer.construction ? { construction: { ...construction, gates: peer.construction.gates } } : {}),
          ...(kitchen && peer.kitchen ? { kitchen: { ...kitchen, slots: peer.kitchen.slots } } : {}) };
        doc = updateFurniture(doc, id, { ...rest, ...merged } as Partial<Omit<Furniture, 'id'>>);
      }
      return doc;
    }
    case 'column': {
      const patch = changedKeys(before.columns?.find((c) => c.id === primaryId), after.columns?.find((c) => c.id === primaryId), COLUMN_KEYS);
      if (!Object.keys(patch).length) return after;
      for (const id of peerIds) doc = updateColumn(doc, id, patch);
      return doc;
    }
    case 'room': {
      const patch = changedKeys<FloorFinish, (typeof FINISH_KEYS)[number]>(floorFinish(before, primaryId), floorFinish(after, primaryId), FINISH_KEYS);
      if (!Object.keys(patch).length) return after;
      for (const id of peerIds) doc = setFloorFinish(doc, id, patch);
      return doc;
    }
    default: return after;
  }
}
