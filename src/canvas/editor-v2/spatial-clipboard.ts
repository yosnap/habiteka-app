import type { Column, EditorDocument, Furniture, Ramp, Stair } from '@/lib/editor-document/schema';
import { addColumn, addRamp, addStair } from '@/lib/editor-document/construction-commands';
import { editDocument } from './editing-operations';

export type SpatialClipboardItem = Furniture | Stair | Ramp | Column;

export function findSpatialItem(doc: EditorDocument, id: string): SpatialClipboardItem | null {
  return doc.furniture.find((item) => item.id === id) ?? doc.stairs?.find((item) => item.id === id)
    ?? doc.ramps?.find((item) => item.id === id) ?? doc.columns?.find((item) => item.id === id) ?? null;
}

export function duplicateSpatialItem(item: SpatialClipboardItem): SpatialClipboardItem {
  return { ...structuredClone(item), id: crypto.randomUUID() };
}

/** Inserts only movable plan elements; walls and openings have dedicated construction flows. */
export function insertSpatialItem(doc: EditorDocument, item: SpatialClipboardItem): EditorDocument {
  if ('kind' in item && 'stepCount' in item) return addStair(doc, item);
  if ('riseMm' in item) return addRamp(doc, item);
  if (!('kind' in item)) return addColumn(doc, item);
  return editDocument(doc, (next) => { next.furniture.push(item); });
}
