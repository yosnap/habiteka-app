import type { Furniture } from './schema';
import { furnitureSpatial } from './spatial-properties';

/** Local solid volumes shared by rendering and placement, including free space below tables. */
export function furnitureVolumes(item: Furniture) {
  const props = furnitureSpatial(item), top = props.elevationMm + props.heightMm;
  if (/table|mesa/.test(item.kind)) {
    const leg = Math.min(70, item.widthMm / 8, item.depthMm / 8), thickness = Math.min(60, props.heightMm / 5);
    return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm, bottom: top - thickness, top },
      ...[0, item.widthMm - leg].flatMap((x) => [0, item.depthMm - leg].map((y) =>
        ({ x, y, widthMm: leg, depthMm: leg, bottom: props.elevationMm, top: top - thickness })))];
  }
  return [{ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm, bottom: props.elevationMm, top }];
}
