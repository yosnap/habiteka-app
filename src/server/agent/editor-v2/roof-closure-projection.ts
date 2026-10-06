import sharp from 'sharp';
import { PerspectiveCamera, Vector3 } from 'three';
import type { EditorDocument, Wall } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { exteriorRoofGeometry, type RoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { fittedOutputRatio } from './render-reference-frame';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';

/**
 * Maqueta del inmueble con su cubierta vista desde la cámara de una imagen aceptada: muros, huecos y tejado del modelo.
 * Es la guía de forma con la que la IA añade la cubierta a esa imagen. No se pega sobre ella: el generador puede haber
 * reencuadrado la vista (comprobado con isométricas reales) y la IA alinea la cubierta con los muros que ve.
 */
type PieceKind = 'roof' | 'glass' | 'frame' | 'chimney' | 'closure' | 'wall' | 'opening';
interface ProjectedTriangle { kind: PieceKind; points: [number, number][]; depth: number; shade: number }
export interface RoofProjection { triangles: ProjectedTriangle[]; bbox: { x: number; y: number; width: number; height: number } }

const LIGHT = new Vector3(.45, 1, .3).normalize();
const ROOF_KINDS = new Set<PieceKind>(['roof', 'glass', 'frame', 'chimney']);
const GUIDE_MARGIN = .08;

function pieceKind(part: RoofGeometry): PieceKind {
  return part.glazing ? 'glass' : part.frame ? 'frame' : part.chimney ? 'chimney' : 'roof';
}

function cameraFor(view: RenderView) {
  const camera = new PerspectiveCamera(view.fov, view.aspect, .05, 5000);
  camera.position.fromArray(view.position);
  camera.quaternion.fromArray(view.quaternion);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

/** La captura se completa con bandas centradas hasta el formato de salida (`fitRenderReferenceAspect`). */
function outputMapper(view: RenderView, width: number, height: number) {
  const [, ratio] = fittedOutputRatio(view.aspect);
  const sx = view.aspect < ratio ? view.aspect / ratio : 1, sy = view.aspect > ratio ? ratio / view.aspect : 1;
  return (ndc: Vector3): [number, number] => [
    (.5 + ((ndc.x + 1) / 2 - .5) * sx) * width,
    (.5 + ((1 - ndc.y) / 2 - .5) * sy) * height,
  ];
}

/** Muro como prisma de su grosor y altura; los huecos, como paños oscuros apenas por fuera de cada cara. */
function wallPrisms(document: EditorDocument, wall: Wall) {
  const vertex = (id: string) => document.vertices.find(item => item.id === id)!;
  const a = vertex(wall.startVertexId), b = vertex(wall.endVertexId), length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!length) return [];
  const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, nx = -uy, ny = ux;
  const point = (along: number, side: number, up: number) => [(a.x + ux * along + nx * side) / 1000, up / 1000, (a.y + uy * along + ny * side) / 1000];
  const quad = (kind: PieceKind, corners: number[][]) => ({ kind, positions: Float32Array.from(corners.flat()), indices: Uint32Array.from([0, 1, 2, 0, 2, 3]) });
  const half = wall.thicknessMm / 2, height = wallConstruction(wall).heightMm;
  const faces = [-half, half].map(side => quad('wall', [point(0, side, 0), point(length, side, 0), point(length, side, height), point(0, side, height)]));
  const top = quad('wall', [point(0, -half, height), point(length, -half, height), point(length, half, height), point(0, half, height)]);
  const ends = [0, length].map(along => quad('wall', [point(along, -half, 0), point(along, half, 0), point(along, half, height), point(along, -half, height)]));
  const openings = document.openings.filter(item => item.wallId === wall.id).flatMap(opening => {
    const { heightMm, elevationMm } = openingConstruction(opening), center = opening.position * length;
    const from = Math.max(0, center - opening.widthMm / 2), to = Math.min(length, center + opening.widthMm / 2);
    return [-half - 15, half + 15].map(side => quad('opening', [point(from, side, elevationMm), point(to, side, elevationMm),
      point(to, side, elevationMm + heightMm), point(from, side, elevationMm + heightMm)]));
  });
  return [...faces, top, ...ends, ...openings];
}

export function projectRoofModel(document: EditorDocument, view: RenderView, width: number, height: number): RoofProjection {
  if (!document.exteriorRoof) throw new UserFacingError('Este plano no tiene cubierta. Defínela en Exterior › Tejado antes de cerrarla.');
  if (view.allLevels || (document.levels?.length ?? 0) > 1)
    throw new UserFacingError('Cerrar el tejado desde el modelo está disponible para inmuebles de una sola planta.');
  let parts: RoofGeometry[];
  try { parts = exteriorRoofGeometry(document); }
  catch (error) { throw new UserFacingError(`La cubierta del plano no es válida: ${error instanceof Error ? error.message : 'revisa el tejado'}.`); }
  const camera = cameraFor(view), toImage = outputMapper(view, width, height);
  const triangles: ProjectedTriangle[] = [];
  const add = (kind: PieceKind, positions: Float32Array, indices: Uint32Array) => {
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const world = [0, 1, 2].map(offset => new Vector3().fromArray(positions, indices[index + offset]! * 3));
      const ndc = world.map(point => point.clone().project(camera));
      // Un vértice detrás de la cámara o fuera de su profundidad no se puede proyectar sin deformar.
      if (ndc.some(point => point.z < -1 || point.z > 1)) continue;
      const normal = new Vector3().subVectors(world[1]!, world[0]!).cross(new Vector3().subVectors(world[2]!, world[0]!)).normalize();
      if (normal.y < 0) normal.negate();
      const centroid = world[0]!.clone().add(world[1]!).add(world[2]!).divideScalar(3);
      // Distancia real a la cámara (lineal); los huecos se adelantan para quedar sobre su cara de muro.
      triangles.push({ kind, points: ndc.map(toImage), depth: centroid.distanceTo(camera.position) - (kind === 'opening' ? .05 : 0),
        shade: .55 + .45 * Math.max(0, Math.abs(normal.dot(LIGHT))) });
    }
  };
  for (const wall of document.walls.filter(item => !item.hidden && !item.id.startsWith('outdoor:')))
    for (const piece of wallPrisms(document, wall)) add(piece.kind, piece.positions, piece.indices);
  for (const part of parts) {
    add(pieceKind(part), part.positions, part.indices);
    for (const closure of part.wallClosures) add('closure', closure.positions, closure.indices);
  }
  if (!triangles.some(item => ROOF_KINDS.has(item.kind))) throw new UserFacingError('La cubierta no se ve desde la cámara de esta imagen.');
  // Pintor: lo lejano primero. Desde una vista aérea la cubierta queda siempre encima de muros y cierres, que van antes:
  // con faldones grandes la profundidad media no basta para ordenarlos.
  triangles.sort((a, b) => Number(ROOF_KINDS.has(a.kind)) - Number(ROOF_KINDS.has(b.kind)) || b.depth - a.depth);
  const xs = triangles.flatMap(item => item.points.map(point => point[0])), ys = triangles.flatMap(item => item.points.map(point => point[1]));
  const left = Math.max(0, Math.min(...xs)), top = Math.max(0, Math.min(...ys));
  const right = Math.min(width, Math.max(...xs)), bottom = Math.min(height, Math.max(...ys));
  if (right <= left || bottom <= top) throw new UserFacingError('La cubierta queda fuera del encuadre de esta imagen.');
  return { triangles, bbox: { x: left / width, y: top / height, width: (right - left) / width, height: (bottom - top) / height } };
}

const hex = (value: string, shade: number) => {
  const [r, g, b] = [1, 3, 5].map(index => Math.round(parseInt(value.slice(index, index + 2), 16) * shade));
  return `rgb(${r},${g},${b})`;
};
const PIECE_COLORS: Record<Exclude<PieceKind, 'roof'>, string> = {
  glass: '#cfe3ea', frame: '#43494b', chimney: '#c9a58a', closure: '#ece8e1', wall: '#f2efea', opening: '#3c4a52',
};
const path = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Maqueta en color plano sombreado: forma del modelo, no acabado. El vidrio deja ver lo que queda debajo. */
function guideSvg(projection: RoofProjection, roofColor: string, width: number, height: number): string {
  const polygons = projection.triangles.map(item => {
    const color = item.kind === 'roof' ? hex(roofColor, item.shade) : hex(PIECE_COLORS[item.kind], item.kind === 'glass' || item.kind === 'opening' ? 1 : item.shade);
    const opacity = item.kind === 'glass' ? ' fill-opacity="0.45"' : '';
    return `<polygon points="${path(item.points)}" fill="${color}"${opacity} stroke="${color}" stroke-width="0.6"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#e4e3df"/>${polygons}</svg>`;
}

/** Guía recortada al inmueble con margen: la IA la usa para la forma de la cubierta, no para el encuadre. */
export async function roofModelGuidePng(projection: RoofProjection, roofColor: string, width: number, height: number) {
  const full = await sharp(Buffer.from(guideSvg(projection, roofColor, width, height))).png().toBuffer();
  const xs = projection.triangles.flatMap(item => item.points.map(point => point[0])), ys = projection.triangles.flatMap(item => item.points.map(point => point[1]));
  const margin = GUIDE_MARGIN * Math.max(width, height);
  const left = Math.max(0, Math.floor(Math.min(...xs) - margin)), top = Math.max(0, Math.floor(Math.min(...ys) - margin));
  const right = Math.min(width, Math.ceil(Math.max(...xs) + margin)), bottom = Math.min(height, Math.ceil(Math.max(...ys) + margin));
  return sharp(full).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }).png().toBuffer();
}
