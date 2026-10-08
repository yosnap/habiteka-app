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
  return best ? backAgainst(item, best) : item;
}

/** Gira el mueble con la trasera (borde y=0 local) contra la cara y el frente (+y local) hacia la estancia. */
function backAgainst(item: Furniture, hit: Pick<WallFaceHit, 'normal' | 'face'>): Furniture {
  const rotation = Math.atan2(-hit.normal.x, hit.normal.y) * 180 / Math.PI;
  const turned = transformAroundCenter(item, { rotation: Math.round(rotation * 100) / 100 });
  const back = localToWorld(turned, { x: 0, y: 0 });
  const offset = (back.x - hit.face.x) * hit.normal.x + (back.y - hit.face.y) * hit.normal.y;
  return { ...turned, x: turned.x - hit.normal.x * offset, y: turned.y - hit.normal.y * offset };
}

/** Piezas que viven contra una pared; mesas, sillas, alfombras, plantas y lámparas se quedan como las gire el usuario. */
const WALL_PIECES = new Set(['bed', 'sofa', 'sofa-chaise', 'sofa-corner', 'sofa-modular', 'sofa-bed', 'cabinet', 'shelf', 'kitchen',
  'sink', 'toilet', 'bath', 'shower', 'appliance', 'screen']);

/**
 * Al arrastrar o colocar desde el catálogo, una pieza de pared cuyo centro se acerca a un muro recto se gira hacia él,
 * como una puerta se orienta con su muro: un armario que apenas cabe se lleva ya girado a la otra pared en lugar de
 * girarlo donde no hay sitio. Con memoria: mientras siga al alcance un muro que admite el giro que ya tiene la pieza
 * (`preferredRotation`, el de la vista previa), lo conserva; en un rincón, un armario puesto en horizontal no salta a la
 * pared lateral aunque su centro quede más cerca de ella. Solo gira hacia otro muro cuando el suyo queda lejos.
 */
export function orientToNearestWall(doc: EditorDocument, item: Furniture, toleranceMm: number, preferredRotation = item.rotation): Furniture {
  const profile = getFurnitureCatalogEntry(item.catalogId)?.profile;
  if (!profile || !WALL_PIECES.has(profile)) return item;
  const center = objectCenter(item);
  const turn = (normal: { x: number; y: number }) => ((Math.atan2(-normal.x, normal.y) * 180 / Math.PI) % 360 + 360) % 360;
  const keeps = (normal: { x: number; y: number }) => Math.abs(((turn(normal) - preferredRotation) % 360 + 540) % 360 - 180) < 1;
  let best: { distance: number; keeps: boolean; normal: { x: number; y: number }; face: { x: number; y: number } } | null = null;
  for (const wall of doc.walls) {
    if (wall.hidden || wall.curveHeightMm) continue;
    const path = wallPath(doc, wall), a = path.at(0), u = path.tangent(0);
    const along = (center.x - a.x) * u.x + (center.y - a.y) * u.y;
    if (along < 0 || along > path.length) continue;
    const across = (center.x - a.x) * -u.y + (center.y - a.y) * u.x, side = across >= 0 ? 1 : -1, normal = { x: -u.y * side, y: u.x * side };
    const distance = Math.abs(across) - wall.thicknessMm / 2, kept = keeps(normal);
    // Un muro que conserva el giro actual gana a cualquiera que obligue a girar; entre iguales, el más cercano.
    if (distance <= item.depthMm / 2 + toleranceMm && (!best || (kept && !best.keeps) || (kept === best.keeps && distance < best.distance)))
      best = { distance, keeps: kept, normal, face: { x: a.x + normal.x * wall.thicknessMm / 2, y: a.y + normal.y * wall.thicknessMm / 2 } };
  }
  if (!best) return item;
  // Giro entre 0 y 360, como el resto del plano: el panel mostraba -90 donde el usuario pone 270.
  const turned = backAgainst(item, best);
  return { ...turned, rotation: ((turned.rotation % 360) + 360) % 360 };
}

/** Giro máximo con el que un tramo de cocina se endereza contra su muro: corrige desviaciones, no cambia de pared. */
const KITCHEN_RUN_MAX_TURN_DEG = 3;
/**
 * Un tramo de cocina pegado a un muro ligeramente inclinado gira lo justo para apoyar toda la trasera en su cara y no
 * dejar una cuña de holgura. Si el muro más cercano exigiera un giro mayor, el tramo se queda como estaba.
 */
export function alignKitchenRunToWall<T extends Furniture>(doc: EditorDocument, run: T, toleranceMm: number): T {
  const aligned = alignBackToWall(doc, run, toleranceMm) as T;
  const turn = Math.abs((aligned.rotation - run.rotation + 540) % 360 - 180);
  return turn <= KITCHEN_RUN_MAX_TURN_DEG ? aligned : run;
}

const BLINDS = new Set(['roller', 'venetian', 'shutter']), CURTAINS = new Set(['curtain', 'curtain-open']);
/** Una alfombra es un revestimiento del suelo: los muebles se apoyan encima, no chocan con ella. */
export function isFloorCovering(item: Furniture): boolean {
  return getFurnitureCatalogEntry(item.catalogId)?.profile === 'rug';
}
/** Estores, persianas y cortinas cuelgan de la ventana: son una piel sobre el muro, no un volumen que estorbe. */
export function isWindowCovering(item: Furniture): boolean {
  const profile = getFurnitureCatalogEntry(item.catalogId)?.profile;
  return !!profile && (BLINDS.has(profile) || CURTAINS.has(profile));
}
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
