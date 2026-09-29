import type { EditorDocument, Point } from './schema';
import type { ZoneMaskRegions } from './render-view';
import { clipDesignZone } from './design-zone-geometry';
import { polygonArea } from './geometry';
import { footprint } from './spatial-properties';

function overlapArea(a: readonly Point[], b: readonly Point[]): number {
  return clipDesignZone({ polygon: [...a] }, [b.map(({ x, y }) => [x, y])])
    .reduce((sum, part) => sum + Math.abs(polygonArea(part[0]!.map(([x, y]) => ({ x, y })))), 0);
}

/** Conserva en la captura el pilar que recorta una cocina visible, aunque su centro quede fuera de la zona. */
export function zoneCaptureRegions(doc: EditorDocument, regions: ZoneMaskRegions): ZoneMaskRegions {
  if (!regions.length || !doc.kitchenRuns?.length || !doc.columns?.length) return regions;
  const kitchens = doc.kitchenRuns.filter((run) => {
    const shape = footprint(run);
    return regions.some((region) => overlapArea(shape, region) >= Math.abs(polygonArea(shape)) * .2);
  });
  const columns = doc.columns.filter((column) => {
    const shape = footprint(column);
    return kitchens.some((run) => column.elevationMm < run.elevationMm + run.heightMm
      && column.elevationMm + column.heightMm > run.elevationMm
      && overlapArea(shape, footprint(run)) > 1);
  });
  return columns.length ? [...regions, ...columns.map(footprint)] : regions;
}
