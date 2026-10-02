import type { EditorDocument } from '@/lib/editor-document/schema';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { Vector3 } from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';

/** Medidas del diseño y anclas 3D compartidas. No son medidas catastrales. */
export function videoDimensionAnchors(doc: EditorDocument, regions: ZoneMaskRegions = []) {
  const levels = buildingDocuments(doc), points = regions.length ? regions.flat() : levels.flatMap(level => level.document.vertices);
  if (!points.length) return [];
  const x0 = Math.min(...points.map(p => p.x)) / 1000, x1 = Math.max(...points.map(p => p.x)) / 1000;
  const z0 = Math.min(...points.map(p => p.y)) / 1000, z1 = Math.max(...points.map(p => p.y)) / 1000;
  const heightM = Math.max(...levels.flatMap(level => [...level.document.walls.filter(wall => !wall.hidden)
    .map(wall => (level.elevationMm + (wall.baseElevationMm ?? 0) + (wall.heightMm ?? 2700)) / 1000),
    ...exteriorRoofGeometry(level.document).map(part => level.elevationMm / 1000 + part.peakM)]), 0);
  const base = Math.min(...levels.map(level => level.elevationMm / 1000)), offset = Math.max(.4, Math.max(x1 - x0, z1 - z0) * .06);
  return [
    { start: new Vector3(x0, base + .06, z0 - offset), end: new Vector3(x1, base + .06, z0 - offset), value: x1 - x0 },
    { start: new Vector3(x0 - offset, base + .06, z0), end: new Vector3(x0 - offset, base + .06, z1), value: z1 - z0 },
    { start: new Vector3(x1 + offset, base, z1), end: new Vector3(x1 + offset, heightM, z1), value: heightM - base },
  ];
}

export function videoDimensions(doc: EditorDocument, regions: ZoneMaskRegions = []) {
  const anchors = videoDimensionAnchors(doc, regions);
  if (!anchors.length) return null;
  const format = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Plano · ${format(anchors[0]!.value)} × ${format(anchors[1]!.value)} m · altura ${format(anchors[2]!.value)} m`;
}
