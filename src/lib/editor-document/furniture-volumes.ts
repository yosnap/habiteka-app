import { isBoundary } from './boundary-types';
import { boundaryVolumes, boundaryDisplayVolumes } from './boundary-volumes';
import { isKitchenRun } from './kitchen-run-types';
import { kitchenRunDisplayVolumes, kitchenRunVolumes } from './kitchen-run-volumes';
import type { EditorDocument, Furniture } from './schema';
import { furnitureSpatial } from './spatial-properties';
import { catalogFurnitureVolumes, type FurnitureVolume } from './furniture-profiles';
import { furnitureAsset } from './furniture-assets';

/** Local solid volumes shared by rendering and placement, including free space below tables. */
export function furnitureVolumes(item: Furniture, doc?: EditorDocument): FurnitureVolume[] {
  if (isBoundary(item)) return doc ? boundaryDisplayVolumes(item, doc.boundaries ?? []) : boundaryVolumes(item);
  if (isKitchenRun(item)) return doc ? kitchenRunDisplayVolumes(item, doc) : kitchenRunVolumes(item);
  // Real assets use a conservative collision envelope until calibrated proxies exist.
  if (furnitureAsset(item)) {
    const props = furnitureSpatial(item);
    return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm,
      bottom: props.elevationMm, top: props.elevationMm + props.heightMm }];
  }
  const catalog = catalogFurnitureVolumes(item);
  if (catalog) return catalog;
  const props = furnitureSpatial(item), top = props.elevationMm + props.heightMm;
  if (/table|mesa/.test(item.kind)) {
    const leg = Math.min(70, item.widthMm / 8, item.depthMm / 8), thickness = Math.min(60, props.heightMm / 5);
    return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm, bottom: top - thickness, top },
      ...[0, item.widthMm - leg].flatMap((x) => [0, item.depthMm - leg].map((y) =>
        ({ x, y, widthMm: leg, depthMm: leg, bottom: props.elevationMm, top: top - thickness })))];
  }
  return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm, bottom: props.elevationMm, top }];
}
