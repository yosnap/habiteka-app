/** Solapes materiales entre estancias leídas: una frontera dibujada entre dos
 * polígonos superpuestos puede convertirse en un tabique inexistente. */
import polygonClipping, { type MultiPolygon, type Pair, type Ring } from 'polygon-clipping';
import type { PlanImportWarning } from '@/lib/contracts';
import type { SketchPoint, SketchRoom, SketchWall } from './sketch-types';

export interface RoomShape { room: SketchRoom; points: SketchPoint[]; body?: SketchPoint[] }

const MIN_OVERLAP_AREA = 0.001;
const MIN_OVERLAP_RATIO = 0.08;

export function roomOverlapWarnings(shapes: RoomShape[]): PlanImportWarning[] {
  const interior = shapes.filter(({ room }) => room.exterior !== true);
  const warnings: PlanImportWarning[] = [];
  for (let i = 0; i < interior.length; i++) {
    for (let j = i + 1; j < interior.length; j++) {
      const a = interior[i]!, b = interior[j]!;
      let intersection: MultiPolygon;
      try { intersection = polygonClipping.intersection([ring(a.points)], [ring(b.points)]); }
      catch {
        warnings.push({
          code: 'estancias-solapadas',
          message: `No se pudieron comparar los contornos de «${a.room.nombre}» y «${b.room.nombre}». Revisa sus muros en la superposición.`,
        });
        continue;
      }
      if (!materialOverlap(a, b, intersection)) continue;
      warnings.push({
        code: 'estancias-solapadas',
        message: `«${a.room.nombre}» y «${b.room.nombre}» se solapan en la lectura. Comprueba los tabiques en la superposición antes de aceptar el plano.`,
      });
    }
  }
  return warnings;
}

/** Une espacios que la lectura superpone cuando ningún tabique sólido medido los divide. */
export function mergeOpenPlanRooms(shapes: RoomShape[], measuredWalls: SketchWall[]): {
  shapes: RoomShape[];
  warnings: PlanImportWarning[];
} {
  const next = [...shapes];
  const warnings: PlanImportWarning[] = [];
  for (let i = 0; i < next.length; i++) {
    if (next[i]!.room.exterior) continue;
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i]!, b = next[j]!;
      if (b.room.exterior) continue;
      try {
        const intersection = polygonClipping.intersection([ring(a.points)], [ring(b.points)]);
        if (!materialOverlap(a, b, intersection) || hasSolidDivider(intersection, measuredWalls)) continue;
        const union = polygonClipping.union([ring(a.points)], [ring(b.points)]);
        // Varias islas o un patio interior no pueden representarse como una estancia.
        if (union.length !== 1 || union[0]!.length !== 1) continue;
        const points = union[0]![0]!.slice(0, -1).map(([x, y]) => ({ x, y }));
        if (points.length < 4) continue;
        next[i] = {
          room: { nombre: `${a.room.nombre} / ${b.room.nombre}`, poligono: points },
          points,
        };
        next.splice(j, 1);
        warnings.push({
          code: 'estancias-fusionadas',
          message: `«${a.room.nombre}» y «${b.room.nombre}» se superponen sin un tabique sólido detectado. Se muestran como un único espacio; comprueba su contorno y medidas.`,
        });
        i = -1; // Repetir: podría haber un tercer espacio abierto contiguo.
        break;
      } catch { /* El aviso de solape se emitirá después; no se fusiona una geometría inválida. */ }
    }
  }
  return { shapes: next, warnings };
}

function materialOverlap(a: RoomShape, b: RoomShape, intersection: MultiPolygon): boolean {
  const area = multiArea(intersection);
  const smaller = Math.min(Math.abs(ringArea(ring(a.points))), Math.abs(ringArea(ring(b.points))));
  return area >= MIN_OVERLAP_AREA && area >= smaller * MIN_OVERLAP_RATIO;
}

function hasSolidDivider(intersection: MultiPolygon, walls: SketchWall[]): boolean {
  const thicknesses = walls.map((wall) => wall.thickness ?? 0).sort((a, b) => a - b);
  const upperQuartile = thicknesses[Math.floor(thicknesses.length * 0.75)] ?? 0;
  const minThickness = Math.max(0.0045, upperQuartile * 0.5);
  const points = intersection.flat(2);
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  return walls.some((wall) => {
    if ((wall.thickness ?? 0) < minThickness) return false;
    const vertical = Math.abs(wall.x1 - wall.x2) < 0.005;
    const horizontal = Math.abs(wall.y1 - wall.y2) < 0.005;
    const width = box.maxX - box.minX, height = box.maxY - box.minY;
    // Una fachada pegada al borde del solape, o una encimera corta, no separa
    // dos estancias. El divisor debe atravesar el interior de la intersección.
    if (vertical && wall.x1 > box.minX + width * 0.1 && wall.x1 < box.maxX - width * 0.1) {
      const lo = Math.max(Math.min(wall.y1, wall.y2), box.minY);
      const hi = Math.min(Math.max(wall.y1, wall.y2), box.maxY);
      return hi - lo >= Math.max(0.06, height * 0.6) && insideMultiPolygon([wall.x1, (lo + hi) / 2], intersection);
    }
    if (horizontal && wall.y1 > box.minY + height * 0.1 && wall.y1 < box.maxY - height * 0.1) {
      const lo = Math.max(Math.min(wall.x1, wall.x2), box.minX);
      const hi = Math.min(Math.max(wall.x1, wall.x2), box.maxX);
      return hi - lo >= Math.max(0.06, width * 0.6) && insideMultiPolygon([(lo + hi) / 2, wall.y1], intersection);
    }
    return false;
  });
}

function insideMultiPolygon(point: Pair, polygons: MultiPolygon): boolean {
  return polygons.some((polygon) => polygon.length > 0 &&
    insideRing(point, polygon[0]!) && !polygon.slice(1).some((hole) => insideRing(point, hole)));
}

function insideRing(point: Pair, points: Ring): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function ring(points: SketchPoint[]): Ring { return points.map((p): Pair => [p.x, p.y]); }

function ringArea(points: Ring): number {
  return points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length]!;
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function multiArea(polygons: ReturnType<typeof polygonClipping.intersection>): number {
  return polygons.reduce((sum, polygon) => sum + polygon.reduce((area, points) => area + ringArea(points), 0), 0);
}
