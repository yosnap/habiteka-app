import type { EditorDocument } from '@/lib/editor-document/schema';
import { videoMeasurementBounds } from '@/lib/editor-document/video-measurements';
import { Vector3 } from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';

/** Medidas del diseño y anclas 3D compartidas. No son medidas catastrales. */
export function videoDimensionAnchors(doc: EditorDocument, regions: ZoneMaskRegions = []) {
  const bounds = videoMeasurementBounds(doc, regions); if (!bounds) return [];
  const { x0, x1, z0, z1, base, top: heightM } = bounds;
  const offset = Math.max(.4, Math.max(x1 - x0, z1 - z0) * .06);
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
