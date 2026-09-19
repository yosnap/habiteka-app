import { planObjects, isBoundary } from '@/lib/editor-document/boundary-types';
import type { Column, EditorDocument, Furniture, Ramp, Stair } from '@/lib/editor-document/schema';
import { addColumn, addRamp, addStair } from '@/lib/editor-document/construction-commands';
import { editDocument } from './editing-operations';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeBoundaryDocument } from '@/lib/editor-document/boundary-commands';
import { isKitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';

export type SpatialClipboardItem = Furniture | Stair | Ramp | Column;

export function findSpatialItem(doc: EditorDocument, id: string): SpatialClipboardItem | null {
  return planObjects(doc).find((item) => item.id === id) ?? doc.stairs?.find((item) => item.id === id)
    ?? doc.ramps?.find((item) => item.id === id) ?? doc.columns?.find((item) => item.id === id) ?? null;
}

export function duplicateSpatialItem(item: SpatialClipboardItem): SpatialClipboardItem {
  const copy = { ...structuredClone(item), id: crypto.randomUUID() };
  if ('kind' in copy && !('stepCount' in copy) && isBoundary(copy))
    copy.construction.gates.forEach((gate) => { gate.id = crypto.randomUUID(); });
  if ('kind' in copy && !('stepCount' in copy) && isKitchenRun(copy))
    copy.kitchen.slots.forEach((slot) => { slot.id = crypto.randomUUID(); });
  return copy;
}

/** Inserts only movable plan elements; walls and openings have dedicated construction flows. */
export function insertSpatialItem(doc: EditorDocument, item: SpatialClipboardItem): EditorDocument {
  if ('kind' in item && 'stepCount' in item) return addStair(doc, item);
  if ('riseMm' in item) return addRamp(doc, item);
  if (!('kind' in item)) return addColumn(doc, item);
  // Un documento de esquema antiguo se actualiza antes de recibir un objeto con campos espaciales (alto, elevación, color).
  return editDocument(isKitchenRun(item) ? upgradeKitchenDocument(doc) : isBoundary(item) ? upgradeBoundaryDocument(doc) : upgradeSpatialDocument(doc), (next) => {
    if (isKitchenRun(item)) { next.kitchenRuns ??= []; next.kitchenRuns.push(item); }
    else if (isBoundary(item)) { next.boundaries ??= []; next.boundaries.push(item); } else next.furniture.push(item);
  });
}
