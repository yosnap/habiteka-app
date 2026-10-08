import type { EditorDocument, Point } from './schema';
import { setExteriorRoof } from './exterior-roof';
import { exteriorRoofBaseFootprints, exteriorRoofFootprints } from './exterior-roof-footprint';
import { roofOpeningSchema, type RoofOpening } from './roof-opening-types';
import { exteriorRoofGeometry } from './exterior-roof-geometry';

export function rectangleRoofOpening(a: Point, b: Point, kind: RoofOpening['kind'], id = crypto.randomUUID()): RoofOpening {
  return roofOpeningSchema.parse({ id, kind, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    widthMm: Math.abs(a.x - b.x), depthMm: Math.abs(a.y - b.y), rotation: 0 });
}

/** Un clic coloca una pieza centrada; arrastrar conserva la elección de dos esquinas. */
export function placedRoofOpening(a: Point, b: Point, kind: RoofOpening['kind'], id = crypto.randomUUID()): RoofOpening {
  if (Math.hypot(a.x - b.x, a.y - b.y) >= 100) return rectangleRoofOpening(a, b, kind, id);
  const [widthMm, depthMm] = kind === 'roof-window' ? [780, 1180] : kind === 'chimney' ? [500, 500] : [1000, 1000];
  return roofOpeningSchema.parse({ id, kind, x: b.x - widthMm / 2, y: b.y - depthMm / 2, widthMm, depthMm, rotation: 0,
    ...(kind === 'chimney' ? { heightMm: 1200 } : {}) });
}

export function putRoofOpening(input: EditorDocument, value: RoofOpening): EditorDocument {
  if (!input.exteriorRoof) throw new Error('Añade primero un tejado exterior.');
  const opening = roofOpeningSchema.parse(value), existing = input.exteriorRoof.openings ?? [];
  const next = setExteriorRoof(input, { openings: [...existing.filter(item => item.id !== opening.id), opening] });
  exteriorRoofGeometry(next);
  return next;
}

export function deleteRoofOpening(input: EditorDocument, id: string): EditorDocument {
  if (!input.exteriorRoof?.openings?.some(item => item.id === id)) throw new Error('Cristal o ventana de techo no encontrados.');
  return setExteriorRoof(input, { openings: input.exteriorRoof.openings.filter(item => item.id !== id) });
}

/** Conserva la forma del vidrio antiguo. Al reducirlo, el resto del vacío queda cerrado con tejado. */
export function makeRoofGlassEditable(input: EditorDocument): EditorDocument {
  if (input.exteriorRoof?.voidCover !== 'glass') throw new Error('No hay un cristal de patio completo que convertir.');
  const openings: RoofOpening[] = exteriorRoofBaseFootprints(input).filter(part => part.glazing).map(part => {
    const ring = part.rings[0]!;
    const x = Math.min(...ring.map(p => p.x)), y = Math.min(...ring.map(p => p.y));
    const widthMm = Math.max(...ring.map(p => p.x)) - x, depthMm = Math.max(...ring.map(p => p.y)) - y;
    return roofOpeningSchema.parse({ id: crypto.randomUUID(), kind: 'glass', x, y, widthMm, depthMm, rotation: 0,
      outline: ring.slice(0, ring.length - (ring[0]!.x === ring.at(-1)!.x && ring[0]!.y === ring.at(-1)!.y ? 1 : 0))
        .map(p => ({ x: (p.x - x) / widthMm, y: (p.y - y) / depthMm })) });
  });
  const next = setExteriorRoof(input, { voidCover: 'solid', openings: [...(input.exteriorRoof.openings ?? []), ...openings] });
  exteriorRoofFootprints(next);
  return next;
}

export function roofCeilingVoids(doc: EditorDocument): Point[][] {
  if (!doc.exteriorRoof) return [];
  return exteriorRoofFootprints(doc).filter(part => part.glazing || part.frame || part.chimney).map(part => part.rings[0]!);
}
