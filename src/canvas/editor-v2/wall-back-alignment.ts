import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { localToWorld, objectCenter, transformAroundCenter } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';

/**
 * Un mueble que se acerca a un muro recto se gira paralelo con la trasera (borde y=0 local) contra la cara, como una
 * puerta se alinea a su muro. Solo actúa si el mueble ya está más o menos paralelo (frente o trasera hacia el muro):
 * uno colocado perpendicular a propósito (un escritorio de canto) se respeta.
 */
export function alignBackToWall(doc: EditorDocument, item: Furniture, toleranceMm: number): Furniture {
  const corners = [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }].map((p) => localToWorld(item, p));
  const center = objectCenter(item);
  let best: { gap: number; normal: { x: number; y: number }; face: { x: number; y: number } } | null = null;
  for (const wall of doc.walls) {
    if (wall.hidden || wall.curveHeightMm) continue;
    const path = wallPath(doc, wall), a = path.at(0), u = path.tangent(0);
    const along = corners.map((p) => (p.x - a.x) * u.x + (p.y - a.y) * u.y);
    if (Math.max(...along) < 0 || Math.min(...along) > path.length) continue;
    const side = ((center.x - a.x) * -u.y + (center.y - a.y) * u.x) >= 0 ? 1 : -1, normal = { x: -u.y * side, y: u.x * side };
    const gap = Math.min(...corners.map((p) => (p.x - a.x) * normal.x + (p.y - a.y) * normal.y)) - wall.thicknessMm / 2;
    if (Math.abs(gap) <= toleranceMm && (!best || Math.abs(gap) < Math.abs(best.gap)))
      best = { gap, normal, face: { x: a.x + normal.x * wall.thicknessMm / 2, y: a.y + normal.y * wall.thicknessMm / 2 } };
  }
  if (!best) return item;
  // El frente del mueble (+y local) debe apuntar en el sentido de la normal de la cara, hacia la estancia.
  const r = item.rotation * Math.PI / 180, front = { x: -Math.sin(r), y: Math.cos(r) };
  const facing = front.x * best.normal.x + front.y * best.normal.y;
  if (Math.abs(facing) < Math.SQRT1_2) return item;
  const rotation = Math.atan2(-best.normal.x, best.normal.y) * 180 / Math.PI;
  const turned = transformAroundCenter(item, { rotation: Math.round(rotation * 100) / 100 });
  const back = localToWorld(turned, { x: 0, y: 0 });
  const offset = (back.x - best.face.x) * best.normal.x + (back.y - best.face.y) * best.normal.y;
  return { ...turned, x: turned.x - best.normal.x * offset, y: turned.y - best.normal.y * offset };
}
