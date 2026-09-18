import type { EditorDocument, Furniture, Point } from './schema';
import { upgradeConstructionDocument } from './migrations';
import { parseEditorDocument } from './validation';

const colors: Record<string, string> = {
  'plaster-white': '#eeeae2',
  'oak-natural': '#b58b59',
  'wood-oak': '#b58b59',
  'concrete-grey': '#a6a6a0',
  'brick-red': '#a86652',
  'paint-sage': '#9baa98',
  'steel-dark': '#3f484d',
};
export const finishColor = (id: string) => colors[id] ?? '#dedbd3';
export const furnitureSpatial = (f: Furniture) => ({
  heightMm: f.heightMm ?? (/bed|cama/.test(f.kind) ? 550 : 800),
  elevationMm: f.elevationMm ?? 0,
  color: f.color ?? '#8ea69b',
});

/** Explicit edit migration only; defaults preserve the historical 3D projection. */
export function upgradeSpatialDocument(input: EditorDocument): EditorDocument {
  const doc = upgradeConstructionDocument(input);
  if (doc.schemaVersion >= 4) return doc;
  doc.schemaVersion = 4;
  doc.walls = doc.walls.map((w) => ({
    ...w,
    colors: { left: finishColor(w.materials!.left), right: finishColor(w.materials!.right) },
  }));
  doc.openings = doc.openings.map((o) => ({ ...o, colors: { frame: '#f4f1e9', leaf: '#bb956c' } }));
  doc.furniture = doc.furniture.map((f) => ({ ...f, ...furnitureSpatial(f) }));
  doc.stairs = doc.stairs!.map((s) => ({ ...s, color: finishColor(s.materialId) }));
  doc.comments = [];
  return parseEditorDocument(doc);
}

/** Explicit edit migration for the ramp collection; old documents are unchanged until editing it. */
export function upgradeRampDocument(input: EditorDocument): EditorDocument {
  const doc = upgradeSpatialDocument(input);
  if (doc.schemaVersion >= 6) return doc;
  doc.schemaVersion = 6;
  doc.floorFinishes ??= [];
  doc.ramps = [];
  return parseEditorDocument(doc);
}

/** El uso del espacio se guarda en el plano y acompaña toda generación de IA. */
export function setDesignSpaceKind(
  input: EditorDocument,
  designSpaceKind: NonNullable<EditorDocument['designSpaceKind']>,
): EditorDocument {
  const doc = upgradeRampDocument(input);
  if (doc.schemaVersion < 7) doc.schemaVersion = 7;
  doc.designSpaceKind = designSpaceKind;
  return parseEditorDocument(doc);
}
export interface Footprint extends Point {
  widthMm: number;
  depthMm: number;
  rotation: number;
}
export function localToWorld(item: Footprint, point: Point): Point {
  const a = (item.rotation * Math.PI) / 180;
  return {
    x: item.x + Math.cos(a) * point.x - Math.sin(a) * point.y,
    y: item.y + Math.sin(a) * point.x + Math.cos(a) * point.y,
  };
}
export const objectCenter = (item: Footprint) =>
  localToWorld(item, { x: item.widthMm / 2, y: item.depthMm / 2 });
/** Keep historical top-left storage, but rotate and resize around the physical center. */
export function transformAroundCenter<T extends Footprint>(item: T, patch: Partial<T>): T {
  const center = objectCenter(item),
    next = { ...item, ...patch };
  if (patch.rotation !== undefined || patch.widthMm !== undefined || patch.depthMm !== undefined) {
    const offset = objectCenter({ ...next, x: 0, y: 0 });
    if (patch.x === undefined) next.x = center.x - offset.x;
    if (patch.y === undefined) next.y = center.y - offset.y;
  }
  return next;
}
