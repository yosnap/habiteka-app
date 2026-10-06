import sharp from 'sharp';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { isBasicOpeningType, openingType, type OpeningType } from '@/lib/editor-document/opening-types';
import { openingLook } from '@/lib/editor-document/opening-look';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import type { Point } from '@/lib/editor-document/schema';
import { footprint, objectCenter } from '@/lib/editor-document/spatial-properties';
import { furnitureElevation, furnitureFacing, furnitureFront, furnitureHeight, isBed, isSofa, sectionFurnitureLines } from './furniture-views';
import { SECTION_AXES as AXES, sectionVisibility, sectionPointVisible, sectionWallSegments, sectionRoomHint } from './section-visibility';

export type ElevationSide = 'front' | 'back' | 'left' | 'right';
type Pt = { h: number; v: number };
type Shape = { depth: number; svg: (map: (p: Pt) => string) => string };

const OUTPUT_WIDTH = 1600;
const PADDING_MM = 1200;
const WALL = '#e8e3d9', ROOF = '#4b4845', WINDOW = '#8fc3dd', FRAME = '#f4f1e9', DOOR = '#8a6a45', GROUND = '#c9c4ba', CUT = '#2d3436', PASSAGE = '#d6d0c4';
// La trasera del cabecero va tapizada y en otro tono que las puertas del fondo, para no confundirlas.
const WOOD = '#7a5c3e', HEADBOARD_BACK = '#b2a189', MATTRESS = '#f7f3ec', SOFA = '#a79c8c', SOFA_BACK = '#8f8476', FURNITURE = '#cdbb9f', FURNITURE_EDGE = '#8a7656';

const points = (list: Pt[], map: (p: Pt) => string) => list.map(map).join(' ');

function cameraFacingWalls(doc: EditorDocument, side: ElevationSide): Set<string> {
  const axis = AXES[side];
  return new Set(editorDocumentToScene(doc).exteriorWalls
    .filter((wall) => wall.normalX * axis.toward[0] + wall.normalZ * axis.toward[1] > .3).map((wall) => wall.sourceEntityId));
}


/**
 * Estancias abiertas de izquierda a derecha, solo por las franjas en que su fachada es visible. El contorno completo
 * sirve para identificar la estancia; la indicación de franja evita traer su mobiliario oculto al primer plano.
 */
export function sectionRooms(doc: EditorDocument, side: ElevationSide): { name: string; boundary: Point[]; visibilityHint: string }[] {
  const layout = sectionVisibility(doc, side);
  const rooms = [...new Map(layout.strips.filter(strip => strip.opened).map(strip => [strip.room.id, strip.room])).values()];
  return rooms.map(room => ({ boundary: room.boundary,
    visibilityHint: sectionRoomHint(layout, room),
    name: doc.labels.find(label => pointInPolygon(label, room.boundary))?.text.trim() || 'Estancia' }));
}

/** Muebles del plano en cada estancia de la sección, descritos como los ve esta cámara. */
export function sectionFurnitureDescription(doc: EditorDocument, side: ElevationSide, rooms: { name: string; boundary: Point[] }[]) {
  const layout = sectionVisibility(doc, side);
  return sectionFurnitureLines({ ...doc, furniture: doc.furniture.filter(item => sectionPointVisible(layout, objectCenter(item))) }, rooms, AXES[side].toward, AXES[side].h);
}

/**
 * Detalle de cada tipo sobre su rectángulo, como en un alzado de carpintería: montantes de las hojas, triángulo de
 * apertura de las abatibles (el vértice señala el lado de la bisagra; el de la oscilobatiente, además, abajo), flecha
 * doble de las correderas, paneles de la plegable y de la seccional, travesaño de la guillotina y montante del fijo
 * superior. Los tipos básicos conservan su rectángulo liso de siempre.
 */
function openingDetails(type: OpeningType, left: number, right: number, bottom: number, upper: number,
  hingeLeft: boolean): ((map: (p: Pt) => string) => string)[] {
  const line = (list: Pt[], width = 30) => (map: (p: Pt) => string) =>
    `<polyline points="${points(list, map)}" fill="none" stroke="${FRAME}" stroke-width="${width}"/>`;
  const width = right - left, middle = (left + right) / 2, mid = (bottom + upper) / 2;
  const mullions = (count: number) => Array.from({ length: count - 1 }, (_, index) =>
    line([{ h: left + width * (index + 1) / count, v: bottom }, { h: left + width * (index + 1) / count, v: upper }], 40));
  const opening = (from: number, to: number) => line([{ h: to, v: upper }, { h: from, v: mid }, { h: to, v: bottom }], 18);
  const arrow = () => { const a = left + width * .3, b = right - width * .3, head = Math.min(120, width * .08);
    return line([{ h: a + head, v: mid + head }, { h: a, v: mid }, { h: a + head, v: mid - head }, { h: a, v: mid }, { h: b, v: mid },
      { h: b - head, v: mid + head }, { h: b, v: mid }, { h: b - head, v: mid - head }], 24); };
  const at = (fraction: number) => left + width * fraction;
  const transom = type.transomMm ? Math.min(type.transomMm, (upper - bottom) / 2) : 0;
  const rails = (count: number) => Array.from({ length: count - 1 }, (_, index) =>
    line([{ h: left, v: bottom + (upper - bottom) * (index + 1) / count }, { h: right, v: bottom + (upper - bottom) * (index + 1) / count }], 30));
  switch (type.operation) {
    case 'abatible': {
      if (transom) return [line([{ h: left, v: upper - transom }, { h: right, v: upper - transom }], 40),
        ...openingDetails({ ...type, transomMm: undefined }, left, right, bottom, upper - transom, hingeLeft)];
      if (type.mainLeafRatio) {
        const split = hingeLeft ? at(type.mainLeafRatio) : at(1 - type.mainLeafRatio);
        return [line([{ h: split, v: bottom }, { h: split, v: upper }], 40), hingeLeft ? opening(left, split) : opening(right, split)];
      }
      if (type.leaves >= 3) return [...mullions(3), opening(left, at(1 / 3)), opening(at(1 / 3), at(2 / 3)), opening(right, at(2 / 3))];
      const tilt = type.tilt ? [line([{ h: left, v: upper }, { h: middle, v: bottom }, { h: right, v: upper }], 18)] : [];
      return type.leaves >= 2 ? [...mullions(2), opening(left, middle), opening(right, middle)]
        : [hingeLeft ? opening(left, right) : opening(right, left), ...tilt];
    }
    case 'corredera-marco': return [...mullions(Math.min(4, Math.max(2, type.leaves))), arrow()];
    case 'corredera': return type.leaves >= 2 ? [...mullions(2), arrow()] : [arrow()];
    case 'corredera-empotrada': return [arrow()];
    case 'plegable': return mullions(Math.max(2, type.leaves));
    case 'seccional': return rails(Math.max(3, Math.round((upper - bottom) / 530)));
    case 'enrollable': return rails(Math.max(6, Math.round((upper - bottom) / 220)));
    case 'basculante': return Array.from({ length: 7 }, (_, index) => line([{ h: at((index + 1) / 8), v: bottom }, { h: at((index + 1) / 8), v: upper }], 18));
    case 'guillotina': return [line([{ h: left, v: mid }, { h: right, v: mid }], 40),
      line([{ h: middle - 60, v: mid - 200 }, { h: middle, v: mid - 320 }, { h: middle + 60, v: mid - 200 }], 24)];
    default: return [];
  }
}

/** Puertas y ventanas de un muro con su tamaño y su cota reales. */
function openingShapes(doc: EditorDocument, wall: EditorDocument['walls'][number], side: ElevationSide) {
  const axis = AXES[side], path = wallPath(doc, wall), base = wall.baseElevationMm ?? 0;
  return doc.openings.filter((opening) => opening.wallId === wall.id).map((opening) => {
    const center = path.at(opening.position), tangent = path.tangent(opening.position);
    const half = Math.abs(axis.h(tangent.x, tangent.y)) * opening.widthMm / 2, h = axis.h(center.x, center.y);
    const props = openingConstruction(opening), bottom = base + props.elevationMm, upper = bottom + props.heightMm;
    const rect = [{ h: h - half, v: bottom }, { h: h + half, v: bottom }, { h: h + half, v: upper }, { h: h - half, v: upper }];
    const type = openingType(opening);
    // Un paso sin hoja deja ver el fondo: tono claro, no un panel oscuro.
    if (!type) return (map: (p: Pt) => string) => `<polygon points="${points(rect, map)}" fill="${PASSAGE}"/>`;
    // La bisagra «left» está en el inicio del muro: queda a la izquierda del alzado si el muro avanza hacia la derecha.
    const hingeLeft = (props.hinge === 'left') === (axis.h(tangent.x, tangent.y) >= 0);
    const details = isBasicOpeningType(type) ? [] : openingDetails(type, h - half, h + half, bottom, upper, hingeLeft);
    // La corredera de vidrio se ve como una ventana hasta el suelo; la vidriera, vidrio en su bastidor con zócalo macizo.
    const design = openingLook(opening).design;
    const asWindow = type.kind === 'ventana' || type.operation === 'corredera-marco';
    const glazedDoor = !asWindow && (type.glazed || design === 'vidrio' || design === 'vidrio-cuadriculado');
    const stile = Math.min(110, half / 3), glass = [{ h: h - half + stile, v: bottom + stile * 2 }, { h: h + half - stile, v: bottom + stile * 2 },
      { h: h + half - stile, v: upper - stile }, { h: h - half + stile, v: upper - stile }];
    return (map: (p: Pt) => string) => (asWindow
      ? `<polygon points="${points(rect, map)}" fill="${WINDOW}" stroke="${FRAME}" stroke-width="60"/>`
      : `<polygon points="${points(rect, map)}" fill="${DOOR}" stroke="${FRAME}" stroke-width="${type.frameMm > 45 ? 80 : 50}"/>${glazedDoor
        ? `<polygon points="${points(glass, map)}" fill="${WINDOW}"/>` : ''}`) + details.map((draw) => draw(map)).join('');
  });
}

/**
 * Fachada: muros exteriores orientados a la cámara. Sección (`cut`): esos muros se retiran con todo lo que llevan y se
 * ven las paredes interiores de frente y los tabiques cortados en oscuro, como en una maqueta abierta a la altura de los ojos.
 */
function wallShapes(doc: EditorDocument, side: ElevationSide, cut: boolean): Shape[] {
  const axis = AXES[side], facing = cameraFacingWalls(doc, side), layout = cut ? sectionVisibility(doc, side) : null;
  return doc.walls.filter((wall) => !wall.hidden && facing.has(wall.id) !== cut).flatMap((wall, wallIndex) => {
    const path = wallPath(doc, wall), tangent = path.tangent(.5);
    const segments: [Point, Point][] = layout ? sectionWallSegments(layout, path.at(0), path.at(1), wall.thicknessMm) : [[path.at(0), path.at(1)]];
    return segments.map(([start, end], segmentIndex) => {
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
    const clip = `wall-${wallIndex}-${segmentIndex}`;
    return { depth: (depths[0]! + depths[1]!) / 2,
      svg: (map) => `<defs><clipPath id="${clip}"><polygon points="${points(body, map)}"/></clipPath></defs><g clip-path="url(#${clip})"><polygon points="${points(body, map)}" fill="${WALL}" stroke="${WALL}" stroke-width="12"/>${openings.map((draw) => draw(map)).join('')}</g>` };
    });
  });
}

/**
 * Muebles de las estancias abiertas en alzado, según cómo los ve la cámara: una cama de espaldas es la trasera de su
 * cabecero en primer plano; de frente, colchón y almohadas delante del cabecero; de perfil, el cabecero a un lado. El
 * generador sigue el dibujo de la sección mucho más que el texto, que no bastó para que dejara de girar las camas.
 */
function furnitureShapes(doc: EditorDocument, side: ElevationSide, rooms: { boundary: Point[] }[]): Shape[] {
  const axis = AXES[side], layout = sectionVisibility(doc, side);
  return doc.furniture.filter((item) => sectionPointVisible(layout, objectCenter(item)) && rooms.some((room) => pointInPolygon(objectCenter(item), room.boundary))).map((item) => {
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
export async function rasterizeEditorElevation(doc: EditorDocument, side: ElevationSide, options: { cut?: boolean; furniture?: boolean } = {}) {
  const cut = options.cut === true;
  const shapes = wallShapes(doc, side, cut);
  if (cut && options.furniture !== false) shapes.push(...furnitureShapes(doc, side, sectionRooms(doc, side)));
  // La sección está abierta por arriba: no añadir una losa que no existe en la vista sin techo.
  if (!cut) for (const roof of exteriorRoofGeometry(doc)) {
    shapes.push(...meshShapes(roof.positions, roof.indices, side, ROOF));
    for (const closure of roof.wallClosures) shapes.push(...meshShapes(closure.positions, closure.indices, side, WALL));
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
