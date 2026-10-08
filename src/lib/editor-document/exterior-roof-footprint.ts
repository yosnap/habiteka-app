import polygonClipping, { type Pair, type Polygon } from 'polygon-clipping';
import type { EditorDocument, Point } from './schema';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { roofOpeningPoints } from './roof-opening-types';

export interface RoofFootprint { rings: Point[][]; baseMm: number; glazing?: boolean; frame?: boolean; chimney?: boolean; openingId?: string; slopeBoundary?: Point[]; }
/** Desplaza las aristas exteriores. Los huecos de patios se conservan abiertos. */
function overhang(points: Point[], amount: number): Pair[] {
  const ring = points.length > 1 && points[0]!.x === points.at(-1)!.x && points[0]!.y === points.at(-1)!.y ? points.slice(0, -1) : points;
  const signed = ring.reduce((area, p, i) => { const q = ring[(i + 1) % ring.length]!; return area + p.x * q.y - q.x * p.y; }, 0);
  const sign = signed > 0 ? 1 : -1;
  return ring.map((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length]!, b = ring[(i + 1) % ring.length]!;
    const lengthA = Math.hypot(p.x - a.x, p.y - a.y), lengthB = Math.hypot(b.x - p.x, b.y - p.y);
    const ax = (p.y - a.y) / lengthA * sign, ay = -(p.x - a.x) / lengthA * sign;
    const bx = (b.y - p.y) / lengthB * sign, by = -(b.x - p.x) / lengthB * sign;
    const denominator = 1 + ax * bx + ay * by;
    const factor = Math.min(amount / Math.max(.05, denominator), amount * 4);
    return [p.x + (ax + bx) * factor, p.y + (ay + by) * factor];
  });
}

export function exteriorRoofBaseFootprints(doc: EditorDocument): RoofFootprint[] {
  const roof = doc.exteriorRoof;
  if (!roof) return [];
  const selected = new Set(roof.roomIds), rooms = eligibleCeilingRooms(doc).filter(room => selected.has(room.id));
  if (rooms.length !== selected.size) throw new Error('El tejado apunta a estancias que cambiaron. Revisa sus habitaciones antes de exportar.');
  const polygons: Polygon[] = rooms.map(room => [room.boundary.map(p => [p.x, p.y] as Pair)]);
  if (!polygons.length) throw new Error('Selecciona las estancias que debe cubrir el tejado.');
  const merged = polygonClipping.union(polygons[0]!, ...polygons.slice(1));
  const wallIds = new Set(rooms.flatMap(room => room.wallIds));
  const walls = doc.walls.filter(wall => wallIds.has(wall.id) && !wall.hidden);
  const baseMm = walls.length ? Math.max(...walls.map(wall => (wall.baseElevationMm ?? 0) + (wall.heightMm ?? 2700))) : 2700;
  return merged.flatMap(polygon => {
    const rings = polygon.map(ring => ring.map(([x, y]) => ({ x, y })));
    const expanded = overhang(rings[0]!, roof.eavesMm + Math.max(0, ...walls.map(w => w.thicknessMm / 2)));
    const normalized = polygonClipping.union([expanded, ...polygon.slice(1)]);
    if (normalized.length !== 1) throw new Error('Reduce el alero: esa distancia genera una cubierta fragmentada.');
    const outline = normalized[0]!.map(ring => ring.map(([x, y]) => ({ x, y })));
    if (roof.voidCover === 'solid') return [{ rings: [outline[0]!], baseMm }];
    const opaque: RoofFootprint = { rings: outline, baseMm };
    return roof.voidCover === 'glass' ? [opaque, ...outline.slice(1).map(ring => ({
      rings: [ring], baseMm, glazing: true, slopeBoundary: outline[0]!,
    }))] : [opaque];
  });
}

const polygon = (ring: Point[]): Polygon => [ring.map(point => [point.x, point.y] as Pair)];
const points = (shape: Polygon) => shape.map(ring => ring.map(([x, y]) => ({ x, y })));
const area = (shapes: Polygon[]) => shapes.reduce((total, shape) => total + shape.reduce((sum, ring, index) =>
  sum + (index ? -1 : 1) * Math.abs(ring.reduce((n, p, i) => { const q = ring[(i + 1) % ring.length]!; return n + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2, 0), 0);

/** Recorta huecos reales en la cubierta opaca y añade vidrio/marco con la misma pendiente. */
export function exteriorRoofFootprints(doc: EditorDocument): RoofFootprint[] {
  const base = exteriorRoofBaseFootprints(doc), openings = doc.exteriorRoof?.openings ?? [];
  if (!openings.length) return base;
  const opaque = base.filter(part => !part.glazing);
  const envelopes = opaque.map(part => polygon(part.rings[0]!));
  const cuts = openings.map(opening => polygon(roofOpeningPoints(opening)));
  for (let i = 0; i < cuts.length; i++) {
    if (area(polygonClipping.difference(cuts[i]!, ...envelopes)) > 1)
      throw new Error('La pieza debe quedar completamente dentro del tejado.');
    if (i && area(polygonClipping.intersection(cuts[i]!, polygonClipping.union(cuts[0]!, ...cuts.slice(1, i)))) > 1)
      throw new Error('Las piezas del tejado no pueden solaparse.');
    if (base.some(part => part.glazing && area(polygonClipping.intersection(cuts[i]!, polygon(part.rings[0]!))) > 1))
      throw new Error('Convierte primero el cristal de los patios en piezas editables.');
  }
  const result = opaque.flatMap(part => polygonClipping.difference(part.rings.map(ring => ring.map(p => [p.x, p.y] as Pair)), ...cuts)
    .map(shape => ({ ...part, rings: points(shape), slopeBoundary: part.rings[0]! })));
  const glass = base.filter(part => part.glazing);
  for (let i = 0; i < openings.length; i++) {
    const opening = openings[i]!, parent = opaque.find(part => area(polygonClipping.difference(cuts[i]!, polygon(part.rings[0]!))) <= 1);
    if (!parent) throw new Error('Coloca cada pieza sobre una sola cubierta.');
    const slopeBoundary = parent.rings[0]!, shared = { baseMm: parent.baseMm, slopeBoundary, openingId: opening.id };
    if (opening.kind === 'chimney') {
      result.push({ ...shared, rings: [roofOpeningPoints(opening), roofOpeningPoints(opening, 60)], chimney: true });
      continue;
    }
    const glassRing = roofOpeningPoints(opening, opening.kind === 'roof-window' ? 50 : 0);
    glass.push({ ...shared, rings: [glassRing], glazing: true });
    if (opening.kind === 'roof-window') result.push({ ...shared, rings: [roofOpeningPoints(opening), glassRing], frame: true });
  }
  return [...result, ...glass];
}
