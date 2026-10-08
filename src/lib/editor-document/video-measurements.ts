import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { exteriorRoofGeometry } from './exterior-roof-geometry';
import type { ZoneMaskRegions } from './render-view';

export type VideoMeasurements = { widthM: number; depthM: number; heightM: number };
export function videoMeasurementBounds(doc: EditorDocument, regions: ZoneMaskRegions = []) {
  const levels = buildingDocuments(doc), points = regions.length ? regions.flat() : levels.flatMap(level => level.document.vertices);
  if (!points.length) return null;
  const x0 = Math.min(...points.map(p => p.x)) / 1000, x1 = Math.max(...points.map(p => p.x)) / 1000;
  const z0 = Math.min(...points.map(p => p.y)) / 1000, z1 = Math.max(...points.map(p => p.y)) / 1000;
  const heightM = Math.max(...levels.flatMap(level => [...level.document.walls.filter(wall => !wall.hidden)
    .map(wall => (level.elevationMm + (wall.baseElevationMm ?? 0) + (wall.heightMm ?? 2700)) / 1000),
    ...exteriorRoofGeometry(level.document).map(part => level.elevationMm / 1000 + part.peakM)]), 0);
  const base = Math.min(...levels.map(level => level.elevationMm / 1000));
  return { x0, x1, z0, z1, base, top: heightM };
}
/** Cotas del documento aprobado, no estimadas a partir de píxeles de una imagen IA. */
export function videoMeasurements(doc: EditorDocument): VideoMeasurements | null {
  const bounds = videoMeasurementBounds(doc);
  if (!bounds) return null;
  const result = { widthM: bounds.x1 - bounds.x0, depthM: bounds.z1 - bounds.z0, heightM: bounds.top - bounds.base };
  return Object.values(result).every(value => Number.isFinite(value) && value > 0) ? result : null;
}
