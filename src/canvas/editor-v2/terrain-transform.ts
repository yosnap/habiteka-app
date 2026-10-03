import type { EditorDocument, Point, TerrainSurface } from '@/lib/editor-document/schema';
import { alignPoint, alignPoints, footprintAnchors } from './magnetic-alignment';

export const TERRAIN_HANDLES = [
  [0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5],
] as const;

/** El giro de un terreno pertenece a la textura, nunca a su huella rectangular. */
export function terrainAnchors(surface: TerrainSurface) {
  return footprintAnchors({ ...surface, rotation: 0 });
}

export function snapTerrainMove(doc: EditorDocument, surface: TerrainSurface, delta: Point, scale: number, enabled: boolean) {
  const moving = terrainAnchors(surface).map(point => ({ x: point.x + delta.x, y: point.y + delta.y }));
  const result = alignPoints(doc, moving, scale, enabled, [surface.id]);
  return { ...result, delta: { x: delta.x + result.delta.x, y: delta.y + result.delta.y } };
}

/** El borde opuesto permanece fijo; los tiradores laterales cambian una sola dimensión. */
export function resizeTerrainSurface(surface: TerrainSurface, handle: number, pointer: Point) {
  const [hx, hy] = TERRAIN_HANDLES[handle]!;
  const axis = (origin: number, size: number, side: number, value: number) => {
    if (side === .5) return { origin, size };
    const fixed = side === 0 ? origin + size : origin;
    const nextSize = Math.max(50, Math.min(200000, Math.abs(value - fixed)));
    return { origin: value < fixed ? fixed - nextSize : fixed, size: nextSize };
  };
  const x = axis(surface.x, surface.widthMm, hx, pointer.x), y = axis(surface.y, surface.depthMm, hy, pointer.y);
  return { ...surface, x: x.origin, y: y.origin, widthMm: x.size, depthMm: y.size };
}

export function snapTerrainResize(doc: EditorDocument, surface: TerrainSurface, handle: number, pointer: Point, scale: number, enabled: boolean) {
  const [hx, hy] = TERRAIN_HANDLES[handle]!;
  const result = alignPoint(doc, pointer, scale, enabled, [surface.id]);
  const resized = resizeTerrainSurface(surface, handle, result.point);
  // No dibujar una guía en el eje que no cambia ni cuando el límite de tamaño impide llegar a ella.
  const guides = result.guides.filter(guide => guide.from.x === guide.to.x
    ? hx !== .5 && [resized.x, resized.x + resized.widthMm].some(x => Math.abs(x - guide.from.x) < .01)
    : hy !== .5 && [resized.y, resized.y + resized.depthMm].some(y => Math.abs(y - guide.from.y) < .01));
  return { surface: resized, guides };
}
