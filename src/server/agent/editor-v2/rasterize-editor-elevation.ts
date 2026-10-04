import sharp from 'sharp';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import type { Point } from '@/lib/editor-document/schema';
import { footprint, objectCenter } from '@/lib/editor-document/spatial-properties';
import { furnitureElevation, furnitureFacing, furnitureFront, furnitureHeight, isBed, isSofa, sectionFurnitureLines } from './furniture-views';

export type ElevationSide = 'front' | 'back' | 'left' | 'right';
type Pt = { h: number; v: number };
type Shape = { depth: number; svg: (map: (p: Pt) => string) => string };

const OUTPUT_WIDTH = 1600;
const PADDING_MM = 1200;
const WALL = '#e8e3d9', ROOF = '#4b4845', WINDOW = '#8fc3dd', FRAME = '#f4f1e9', DOOR = '#8a6a45', GROUND = '#c9c4ba', CUT = '#2d3436', PASSAGE = '#d6d0c4';
// La trasera del cabecero va tapizada y en otro tono que las puertas del fondo, para no confundirlas.
const WOOD = '#7a5c3e', HEADBOARD_BACK = '#b2a189', MATTRESS = '#f7f3ec', SOFA = '#a79c8c', SOFA_BACK = '#8f8476', FURNITURE = '#cdbb9f', FURNITURE_EDGE = '#8a7656';

/**
 * Cada fachada vista de frente, en proyección ortogonal: eje horizontal de izquierda a derecha según la cámara y
 * profundidad creciente hacia el fondo. Coincide con la orientación de los alzados del 3D.
 */
const AXES: Record<ElevationSide, { h: (x: number, y: number) => number; depth: (x: number, y: number) => number; toward: [number, number] }> = {
  front: { h: (x) => x, depth: (_x, y) => -y, toward: [0, 1] },
  back: { h: (x) => -x, depth: (_x, y) => y, toward: [0, -1] },
  left: { h: (_x, y) => y, depth: (x) => x, toward: [-1, 0] },
  right: { h: (_x, y) => -y, depth: (x) => -x, toward: [1, 0] },
};

const points = (list: Pt[], map: (p: Pt) => string) => list.map(map).join(' ');

function cameraFacingWalls(doc: EditorDocument, side: ElevationSide): Set<string> {
  const axis = AXES[side];
  return new Set(editorDocumentToScene(doc).exteriorWalls
    .filter((wall) => wall.normalX * axis.toward[0] + wall.normalZ * axis.toward[1] > .3).map((wall) => wall.sourceEntityId));
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/**
 * Estancias que quedan abiertas al retirar la fachada del lado de cámara, de izquierda a derecha. Son las que tocan esos
 * muros; una franja por profundidad colaba estancias de la segunda fila y el generador las apilaba como altillos. Se
 * ordenan por los vértices de su contorno sobre esa fachada, no por su extremo: un paso abierto une a veces lavadero y
 * pasillo en un polígono que cruza la casa, y el lavadero se adelantaba en el orden que reciben el generador y Jev.
 */
export function sectionRooms(doc: EditorDocument, side: ElevationSide): { name: string; boundary: Point[] }[] {
  const axis = AXES[side], removed = cameraFacingWalls(doc, side);
  const facade = doc.walls.filter((wall) => removed.has(wall.id)).map((wall) => {
    const path = wallPath(doc, wall);
    return { samples: Array.from({ length: 11 }, (_, index) => path.at(index / 10)), reach: Math.max(wall.thicknessMm, 50) };
  });
  const onFacade = (p: Point) => facade.some(({ samples, reach }) =>
    samples.slice(1).some((point, index) => distanceToSegment(p, samples[index]!, point) <= reach));
  return deriveRoomsSafe(doc).filter((room) => room.wallIds.some((id) => removed.has(id))).map((room) => {
    const along = (room.boundary.some(onFacade) ? room.boundary.filter(onFacade) : room.boundary).map((p) => axis.h(p.x, p.y));
    return { boundary: room.boundary, position: along.reduce((sum, h) => sum + h, 0) / along.length,
      name: doc.labels.find((label) => pointInPolygon(label, room.boundary))?.text.trim() || 'Estancia' };
  }).sort((a, b) => a.position - b.position).map(({ name, boundary }) => ({ name, boundary }));
}

/** Muebles del plano en cada estancia de la sección, descritos como los ve esta cámara. */
export function sectionFurnitureDescription(doc: EditorDocument, side: ElevationSide, rooms: { name: string; boundary: Point[] }[]) {
  return sectionFurnitureLines(doc, rooms, AXES[side].toward, AXES[side].h);
}

/** Puertas y ventanas de un muro con su tamaño y su cota reales. */
function openingShapes(doc: EditorDocument, wall: EditorDocument['walls'][number], side: ElevationSide) {
  const axis = AXES[side], path = wallPath(doc, wall), base = wall.baseElevationMm ?? 0;
  return doc.openings.filter((opening) => opening.wallId === wall.id).map((opening) => {
    const center = path.at(opening.position), tangent = path.tangent(opening.position);
    const half = Math.abs(axis.h(tangent.x, tangent.y)) * opening.widthMm / 2, h = axis.h(center.x, center.y);
    const props = openingConstruction(opening), bottom = base + props.elevationMm, upper = bottom + props.heightMm;
    const rect = [{ h: h - half, v: bottom }, { h: h + half, v: bottom }, { h: h + half, v: upper }, { h: h - half, v: upper }];
    return opening.kind === 'ventana'
      ? (map: (p: Pt) => string) => `<polygon points="${points(rect, map)}" fill="${WINDOW}" stroke="${FRAME}" stroke-width="60"/>`
      : opening.kind === 'puerta'
        ? (map: (p: Pt) => string) => `<polygon points="${points(rect, map)}" fill="${DOOR}" stroke="${FRAME}" stroke-width="50"/>`
        // Un paso sin hoja deja ver el fondo: tono claro, no un panel oscuro.
        : (map: (p: Pt) => string) => `<polygon points="${points(rect, map)}" fill="${PASSAGE}"/>`;
  });
}

/**
 * Fachada: muros exteriores orientados a la cámara. Sección (`cut`): esos muros se retiran con todo lo que llevan y se
 * ven las paredes interiores de frente y los tabiques cortados en oscuro, como en una maqueta abierta a la altura de los ojos.
 */
function wallShapes(doc: EditorDocument, side: ElevationSide, cut: boolean): Shape[] {
  const axis = AXES[side], facing = cameraFacingWalls(doc, side);
  return doc.walls.filter((wall) => !wall.hidden && facing.has(wall.id) !== cut).map((wall) => {
    const path = wallPath(doc, wall), start = path.at(0), end = path.at(1), tangent = path.tangent(.5);
    const base = wall.baseElevationMm ?? 0, top = base + (wall.heightMm ?? 2800);
    const depths = [axis.depth(start.x, start.y), axis.depth(end.x, end.y)];
    // Un tabique perpendicular a la cámara se ve de canto: en la sección es una banda oscura con su grosor.
    if (cut && Math.abs(axis.h(tangent.x, tangent.y)) < .5) {
      const h = axis.h((start.x + end.x) / 2, (start.y + end.y) / 2), half = Math.max(wall.thicknessMm, 80) / 2;
      const band = [{ h: h - half, v: base }, { h: h + half, v: base }, { h: h + half, v: top }, { h: h - half, v: top }];
      return { depth: Math.min(...depths), svg: (map) => `<polygon points="${points(band, map)}" fill="${CUT}"/>` };
    }
    const [h1, h2] = [axis.h(start.x, start.y), axis.h(end.x, end.y)].sort((a, b) => a - b) as [number, number];
    const body = [{ h: h1, v: base }, { h: h2, v: base }, { h: h2, v: top }, { h: h1, v: top }];
    const openings = openingShapes(doc, wall, side);
    // Sin trazo: el muro y su prolongación hasta el tejado deben leerse como una sola fachada.
    return { depth: (depths[0]! + depths[1]!) / 2,
      svg: (map) => `<polygon points="${points(body, map)}" fill="${WALL}" stroke="${WALL}" stroke-width="12"/>${openings.map((draw) => draw(map)).join('')}` };
  });
}

/**
 * Muebles de las estancias abiertas en alzado, según cómo los ve la cámara: una cama de espaldas es la trasera de su
 * cabecero en primer plano; de frente, colchón y almohadas delante del cabecero; de perfil, el cabecero a un lado. El
 * generador sigue el dibujo de la sección mucho más que el texto, que no bastó para que dejara de girar las camas.
 */
function furnitureShapes(doc: EditorDocument, side: ElevationSide, rooms: { boundary: Point[] }[]): Shape[] {
  const axis = AXES[side];
  return doc.furniture.filter((item) => rooms.some((room) => pointInPolygon(objectCenter(item), room.boundary))).map((item) => {
    const corners = footprint(item), hs = corners.map((p) => axis.h(p.x, p.y));
    const left = Math.min(...hs), right = Math.max(...hs), base = furnitureElevation(item), height = furnitureHeight(item);
    const depth = corners.reduce((sum, p) => sum + axis.depth(p.x, p.y), 0) / corners.length;
    const rect = (h1: number, h2: number, v1: number, v2: number, fill: string, edge = FURNITURE_EDGE) => (map: (p: Pt) => string) =>
      `<polygon points="${points([{ h: h1, v: v1 }, { h: h2, v: v1 }, { h: h2, v: v2 }, { h: h1, v: v2 }], map)}" fill="${fill}" stroke="${edge}" stroke-width="20"/>`;
    const facing = furnitureFacing(item, axis.toward), front = furnitureFront(item);
    // Extremo del cabecero o respaldo cuando el mueble se ve de perfil.
    const backLeft = axis.h(-front.x, -front.y) < 0, span = right - left, end = Math.max(60, span * .1);
    const backEnd = backLeft ? [left, left + end] as const : [right - end, right] as const;
    let parts: ((map: (p: Pt) => string) => string)[];
    if (isBed(item)) {
      const mattress = base + height * .64;
      parts = facing === 'espaldas' ? [rect(left, right, base, base + height, HEADBOARD_BACK, WOOD)]
        : facing === 'frente' ? [rect(left, right, mattress - 40, base + height, WOOD), rect(left, right, base, base + height * .22, WOOD),
          rect(left, right, base + height * .22, mattress, MATTRESS),
          ...(span < 1200 ? [rect(left + span * .2, right - span * .2, mattress, mattress + height * .14, MATTRESS)]
            : [rect(left + span * .08, left + span * .46, mattress, mattress + height * .14, MATTRESS),
              rect(right - span * .46, right - span * .08, mattress, mattress + height * .14, MATTRESS)])]
        : [rect(left, right, base, base + height * .22, WOOD), rect(left, right, base + height * .22, mattress, MATTRESS),
          rect(backEnd[0], backEnd[1], base, base + height, WOOD)];
    } else if (isSofa(item)) {
      const seat = base + height * .55;
      parts = facing === 'espaldas' ? [rect(left, right, base, base + height, SOFA_BACK)]
        : facing === 'frente' ? [rect(left, right, seat - 40, base + height, SOFA_BACK), rect(left, right, base, seat, SOFA)]
        : [rect(left, right, base, seat, SOFA), rect(backEnd[0], backEnd[1], base, base + height, SOFA_BACK)];
    } else parts = [rect(left, right, base, base + height, FURNITURE)];
    return { depth, svg: (map) => parts.map((draw) => draw(map)).join('') };
  });
}

/** Triángulos del tejado y de los cierres de muro hasta su intradós, proyectados sobre la fachada. */
function meshShapes(positions: Float32Array, indices: Uint32Array, side: ElevationSide, fill: string): Shape[] {
  const axis = AXES[side], shapes: Shape[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const corners = [indices[i]!, indices[i + 1]!, indices[i + 2]!].map((index) => ({
      x: positions[index * 3]! * 1000, up: positions[index * 3 + 1]! * 1000, y: positions[index * 3 + 2]! * 1000 }));
    const projected = corners.map((corner) => ({ h: axis.h(corner.x, corner.y), v: corner.up }));
    const depth = corners.reduce((sum, corner) => sum + axis.depth(corner.x, corner.y), 0) / 3;
    shapes.push({ depth, svg: (map) => `<polygon points="${points(projected, map)}" fill="${fill}" stroke="${fill}" stroke-width="12"/>` });
  }
  return shapes;
}

/** Alzado técnico de una fachada o de su sección: muros, huecos con su tamaño y cota, y tejado. Sin textos ni cotas. */
export async function rasterizeEditorElevation(doc: EditorDocument, side: ElevationSide, options: { cut?: boolean } = {}) {
  const cut = options.cut === true;
  const shapes = wallShapes(doc, side, cut);
  if (cut) shapes.push(...furnitureShapes(doc, side, sectionRooms(doc, side)));
  // La sección es una maqueta abierta: sin tejado, con la línea del techo sobre las estancias.
  if (!cut) for (const roof of exteriorRoofGeometry(doc)) {
    shapes.push(...meshShapes(roof.positions, roof.indices, side, ROOF));
    for (const closure of roof.wallClosures) shapes.push(...meshShapes(closure.positions, closure.indices, side, WALL));
  }
  if (cut && shapes.length) {
    const drawn: Pt[] = [];
    for (const shape of shapes) shape.svg((p) => { drawn.push(p); return ''; });
    const left = Math.min(...drawn.map((p) => p.h)), right = Math.max(...drawn.map((p) => p.h)), ceiling = Math.max(...drawn.map((p) => p.v));
    const slab = [{ h: left, v: ceiling }, { h: right, v: ceiling }, { h: right, v: ceiling + 200 }, { h: left, v: ceiling + 200 }];
    shapes.push({ depth: -Infinity, svg: (map) => `<polygon points="${points(slab, map)}" fill="${CUT}"/>` });
  }
  // Para medir la caja basta con capturar los puntos que dibuja cada forma.
  const measured: Pt[] = [];
  for (const shape of shapes) shape.svg((p) => { measured.push(p); return ''; });
  if (!measured.length) return null;
  const minH = Math.min(...measured.map((p) => p.h)) - PADDING_MM, maxH = Math.max(...measured.map((p) => p.h)) + PADDING_MM;
  const maxV = Math.max(...measured.map((p) => p.v)) + PADDING_MM, minV = Math.min(0, ...measured.map((p) => p.v)) - PADDING_MM;
  const width = maxH - minH, height = maxV - minV;
  const outHeight = Math.round(OUTPUT_WIDTH * height / width);
  const map = (p: Pt) => `${(p.h - minH).toFixed(1)},${(maxV - p.v).toFixed(1)}`;
  const ground = `<rect x="0" y="${(maxV).toFixed(1)}" width="${width.toFixed(1)}" height="${(-minV).toFixed(1)}" fill="${GROUND}"/>`;
  // Del fondo al frente: lo cercano tapa a lo lejano, como en la vista real.
  const body = [...shapes].sort((a, b) => b.depth - a.depth).map((shape) => shape.svg(map)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_WIDTH}" height="${outHeight}" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}"><rect width="100%" height="100%" fill="#fbfaf7"/>${ground}${body}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { base64: png.toString('base64'), mimeType: 'image/png' as const, width: OUTPUT_WIDTH, height: outHeight };
}
