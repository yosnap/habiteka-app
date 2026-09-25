import type { EditorDocument, Furniture, Wall } from '@/lib/editor-document/schema';
import { localToWorld, objectCenter, transformAroundCenter } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { wallFloorElevation } from '@/lib/editor-document/floor-level';
import { wallConstruction } from '@/lib/editor-document/construction-properties';

interface WallFaceHit { wall: Wall; gap: number; score: number; normal: { x: number; y: number }; tangent: { x: number; y: number }; face: { x: number; y: number } }
/** Cara de muro recto más cercana a alguna esquina del mueble, con su normal hacia la estancia. */
function nearestWallFace(doc: EditorDocument, item: Furniture, toleranceMm: number): WallFaceHit | null {
  const corners = [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }].map((p) => localToWorld(item, p));
  const center = objectCenter(item);
  let best: WallFaceHit | null = null;
  for (const wall of doc.walls) {
    if (wall.hidden || wall.curveHeightMm) continue;
    const path = wallPath(doc, wall), a = path.at(0), u = path.tangent(0);
    const along = corners.map((p) => (p.x - a.x) * u.x + (p.y - a.y) * u.y);
    if (Math.max(...along) < 0 || Math.min(...along) > path.length) continue;
    const side = ((center.x - a.x) * -u.y + (center.y - a.y) * u.x) >= 0 ? 1 : -1, normal = { x: -u.y * side, y: u.x * side };
    const gap = Math.min(...corners.map((p) => (p.x - a.x) * normal.x + (p.y - a.y) * normal.y)) - wall.thicknessMm / 2;
    // En una esquina dos caras compiten. Priorizar la que conserva el eje del mueble
    // evita que un desplazamiento mínimo lo gire 90° y salte a la otra pared.
    const angle = item.rotation * Math.PI / 180;
    const parallel = Math.abs(Math.cos(angle) * u.x + Math.sin(angle) * u.y);
    const score = Math.abs(gap) + (1 - parallel) * Math.min(150, toleranceMm / 2);
    if (Math.abs(gap) <= toleranceMm && (!best || score < best.score))
      best = { wall, gap, score, normal, tangent: u, face: { x: a.x + normal.x * wall.thicknessMm / 2, y: a.y + normal.y * wall.thicknessMm / 2 } };
  }
  return best;
}

/**
 * Un mueble que se acerca a un muro recto adopta su dirección: se gira paralelo con la trasera (borde y=0 local) contra
 * la cara y el frente hacia la estancia, como una puerta se alinea a su muro, llegue como llegue.
 */
export function alignBackToWall(doc: EditorDocument, item: Furniture, toleranceMm: number): Furniture {
  const best = nearestWallFace(doc, item, toleranceMm);
  if (!best) return item;
  // El frente del mueble (+y local) apunta en el sentido de la normal de la cara, hacia la estancia.
  const rotation = Math.atan2(-best.normal.x, best.normal.y) * 180 / Math.PI;
  const turned = transformAroundCenter(item, { rotation: Math.round(rotation * 100) / 100 });
  const back = localToWorld(turned, { x: 0, y: 0 });
  const offset = (back.x - best.face.x) * best.normal.x + (back.y - best.face.y) * best.normal.y;
  return { ...turned, x: turned.x - best.normal.x * offset, y: turned.y - best.normal.y * offset };
}

const BLINDS = new Set(['roller', 'venetian', 'shutter']), CURTAINS = new Set(['curtain', 'curtain-open']);
/**
 * Estores, persianas y cortinas se enganchan a la ventana más cercana del muro donde apoyan: centrados en ella y con
 * medidas que la cubren (los estores y persianas nacen a la altura del alféizar; las cortinas llegan hasta el dintel).
 */
export function dockToWindow(doc: EditorDocument, item: Furniture, toleranceMm: number): Furniture {
  const profile = getFurnitureCatalogEntry(item.catalogId)?.profile;
  if (!profile || (!BLINDS.has(profile) && !CURTAINS.has(profile))) return item;
  const hit = nearestWallFace(doc, item, toleranceMm);
  if (!hit) return item;
  const path = wallPath(doc, hit.wall), along = path.project(objectCenter(item)) * path.length;
  const window = doc.openings.filter((o) => o.wallId === hit.wall.id && o.kind === 'ventana')
    .map((o) => ({ o, centreMm: o.position * path.length }))
    .filter(({ o, centreMm }) => Math.abs(centreMm - along) <= item.widthMm / 2 + o.widthMm / 2 + 300)
    .sort((a, b) => Math.abs(a.centreMm - along) - Math.abs(b.centreMm - along))[0];
  if (!window) return item;
  const shift = window.centreMm - along, sill = window.o.elevationMm ?? 900, height = window.o.heightMm ?? 1200;
  const centred = { ...item, x: item.x + hit.tangent.x * shift, y: item.y + hit.tangent.y * shift };
  const floor = wallFloorElevation(doc, hit.wall), wallTop = (hit.wall.baseElevationMm ?? 0) + wallConstruction(hit.wall).heightMm;
  if (BLINDS.has(profile)) return { ...transformAroundCenter(centred, { widthMm: Math.max(centred.widthMm, window.o.widthMm + 100) }),
    elevationMm: Math.max(floor, sill - 100), heightMm: Math.min(wallTop - Math.max(floor, sill - 100), Math.max(centred.heightMm ?? 0, height + 200)) };
  // La cortina arranca del suelo de la estancia (cotas absolutas) y sube hasta 10 cm sobre el dintel sin pasar de la coronación del muro.
  const top = Math.min(wallTop, Math.max(sill + height + 100, floor + (centred.heightMm ?? 0)));
  return { ...transformAroundCenter(centred, { widthMm: Math.max(centred.widthMm, window.o.widthMm + 400) }), elevationMm: floor, heightMm: top - floor };
}
