import polygonClipping, { type Polygon } from 'polygon-clipping';
import type { Point } from './schema';

/** Una capa cubierta completamente no exige una textura invisible en la cenital. */
export function surfaceVisibleInPlan(footprint: Point[], occluders: Point[][]): boolean {
  const polygon = (points: Point[]): Polygon => [points.map(point => [point.x, point.y])];
  const covers = occluders.filter(points => points.length >= 3).map(polygon);
  return !covers.length || polygonClipping.difference(polygon(footprint), ...covers).length > 0;
}
