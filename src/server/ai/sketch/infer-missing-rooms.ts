/** Recupera espacios grandes visibles en el raster que el lector no nombró. */
import polygonClipping, { type Pair, type Ring } from 'polygon-clipping';
import type { PlanZone } from '@/lib/contracts';
import type { SketchPoint, SketchRoom } from './sketch-types';
import type { Scale } from './normalize-geometry';

const MIN_AREA = 0.025;
const MIN_SIDE = 0.12;
const MAX_OVERLAP = 0.12;
const GRID_SNAP = 0.03;

export function inferMissingRooms(rooms: SketchRoom[], regions: PlanZone[], scale: Scale): SketchRoom[] {
  if (rooms.length === 0) return [];
  const existing = [...rooms.map((room) => room.poligono)];
  const allPoints = existing.flat();
  const bounds = {
    minX: Math.min(...allPoints.map((p) => p.x)), maxX: Math.max(...allPoints.map((p) => p.x)),
    minY: Math.min(...allPoints.map((p) => p.y)), maxY: Math.max(...allPoints.map((p) => p.y)),
  };
  const gridX = allPoints.map((point) => point.x);
  const gridY = allPoints.map((point) => point.y);
  const inferred: SketchRoom[] = [];

  for (const region of regions) {
    if (region.name !== 'Estancia' || region.outline.length !== 4) continue;
    const points = region.outline.map((point) => ({
      x: snap(point.x / scale.mmPerUnitX, gridX),
      y: snap(point.y / scale.mmPerUnitY, gridY),
    }));
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const area = (maxX - minX) * (maxY - minY);
    if (maxX - minX < MIN_SIDE || maxY - minY < MIN_SIDE || area < MIN_AREA) continue;
    // Excluye la hoja y las cotas exteriores: un espacio recuperado debe estar
    // dentro de la planta ya delimitada por las estancias leídas.
    if (minX < bounds.minX - GRID_SNAP || maxX > bounds.maxX + GRID_SNAP ||
        minY < bounds.minY - GRID_SNAP || maxY > bounds.maxY + GRID_SNAP) continue;
    try {
      if (existing.reduce((sum, polygon) => sum + intersectionArea(points, polygon), 0) > area * MAX_OVERLAP) continue;
    } catch { continue; }
    const polygon = rect(minX, minY, maxX, maxY);
    inferred.push({ nombre: `Estancia sin identificar ${inferred.length + 1}`, poligono: polygon });
    existing.push(polygon);
  }
  return inferred;
}

function snap(value: number, grid: number[]): number {
  const closest = grid.reduce((best, item) => Math.abs(item - value) < Math.abs(best - value) ? item : best);
  return Math.abs(closest - value) <= GRID_SNAP ? closest : value;
}

function rect(minX: number, minY: number, maxX: number, maxY: number): SketchPoint[] {
  return [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
}

function intersectionArea(a: SketchPoint[], b: SketchPoint[]): number {
  const ring = (points: SketchPoint[]): Ring => points.map((point): Pair => [point.x, point.y]);
  return polygonClipping.intersection([ring(a)], [ring(b)]).reduce((total, polygon) =>
    total + polygon.reduce((sum, points) => sum + Math.abs(points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0)) / 2, 0), 0);
}
