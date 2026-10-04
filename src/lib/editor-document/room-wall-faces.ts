import type { DerivedRoom } from './rooms';
import type { EditorDocument, Point } from './schema';
import { inwardNormal } from './light-strip-geometry';
import { roomInterior, roomInteriorEdges } from './room-interior';
import { wallPath } from './wall-path';

/** Lado de la estancia en el que está el muro, mirando el plano con el norte arriba. */
export type FaceSide = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

/**
 * Cara interior de un muro recto de una estancia. `atMm` es su coordenada fija (y para arriba/abajo, x para los lados)
 * y `fromMm`–`toMm` su tramo en la otra. Quien amuebla elige la pared y el punto; el código pega la pieza a la cara.
 */
export interface RoomWallFace {
  id: string;
  side: FaceSide;
  atMm: number;
  fromMm: number;
  toMm: number;
  /** Tramos de la cara donde no estorba a ninguna puerta ni paso. */
  free: [number, number][];
  windows: [number, number][];
  /** Muros del documento que forman la cara: la IA a veces nombra la pared por el id del muro del contexto. */
  wallIds: string[];
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

const MIN_FACE_MM = 300;
/** Una puerta o paso cuya zona libre llega a menos de esto de la cara ocupa ese tramo de la pared. */
const FACE_REACH_MM = 300;

/** Giro que apoya la trasera de una pieza en esa cara: la del catálogo está en su y local 0. */
export const FACE_ROTATION: Record<FaceSide, number> = { arriba: 0, derecha: 90, abajo: 180, izquierda: 270 };

function subtract(range: [number, number], cuts: [number, number][]): [number, number][] {
  let pieces: [number, number][] = [range];
  for (const [from, to] of cuts)
    pieces = pieces.flatMap(([a, b]) => to <= a || from >= b ? [[a, b] as [number, number]]
      : [[a, Math.max(a, from)] as [number, number], [Math.min(b, to), b] as [number, number]].filter(([x, y]) => y - x >= MIN_FACE_MM));
  return pieces;
}

/**
 * Caras de pared rectas y alineadas con los ejes del suelo útil de una estancia, con los tramos que tapan puertas y pasos
 * y dónde caen las ventanas. Las caras de un límite abierto (muro oculto) no admiten muebles y no se incluyen.
 */
export function roomWallFaces(doc: EditorDocument, room: DerivedRoom, prefix: string, clearZones: Box[]): RoomWallFace[] {
  const interior = roomInterior(doc, room), faces: RoomWallFace[] = [];
  roomInteriorEdges(doc, room).forEach(({ a, b, wall }) => {
    if (!wall || wall.hidden) return;
    const horizontal = Math.abs(a.y - b.y) < 1, vertical = Math.abs(a.x - b.x) < 1;
    if (!horizontal && !vertical) return;
    const normal = inwardNormal(a, b, interior);
    const side: FaceSide = horizontal ? (normal.y > 0 ? 'arriba' : 'abajo') : (normal.x > 0 ? 'izquierda' : 'derecha');
    const atMm = horizontal ? a.y : a.x, fromMm = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), toMm = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
    const previous = faces.at(-1);
    // Un vértice intermedio en la misma recta (una junta de muros) no parte la pared en dos.
    if (previous && previous.side === side && Math.abs(previous.atMm - atMm) < 1 && (Math.abs(previous.toMm - fromMm) < 1 || Math.abs(previous.fromMm - toMm) < 1)) {
      previous.fromMm = Math.min(previous.fromMm, fromMm); previous.toMm = Math.max(previous.toMm, toMm);
      if (!previous.wallIds.includes(wall.id)) previous.wallIds.push(wall.id);
    } else if (toMm - fromMm >= MIN_FACE_MM) faces.push({ id: '', side, atMm, fromMm, toMm, free: [], windows: [], wallIds: [wall.id] });
  });
  return faces.map((face, index) => {
    const horizontal = face.side === 'arriba' || face.side === 'abajo', inward = face.side === 'arriba' || face.side === 'izquierda' ? 1 : -1;
    const near = [face.atMm, face.atMm + inward * FACE_REACH_MM].sort((x, y) => x - y) as [number, number];
    const cuts = clearZones.filter((box) => horizontal ? box.minY < near[1] && box.maxY > near[0] : box.minX < near[1] && box.maxX > near[0])
      .map((box) => (horizontal ? [box.minX, box.maxX] : [box.minY, box.maxY]) as [number, number]).sort((x, y) => x[0] - y[0]);
    const windows = doc.openings.flatMap((opening) => {
      if (opening.kind !== 'ventana') return [];
      const wall = doc.walls.find((item) => item.id === opening.wallId);
      if (!wall) return [];
      const centre: Point = wallPath(doc, wall).at(opening.position);
      const across = horizontal ? centre.y : centre.x, along = horizontal ? centre.x : centre.y;
      if (Math.abs(across - face.atMm) > wall.thicknessMm || along < face.fromMm || along > face.toMm) return [];
      return [[Math.round(along - opening.widthMm / 2), Math.round(along + opening.widthMm / 2)] as [number, number]];
    });
    const round = ([a, b]: [number, number]) => [Math.round(a), Math.round(b)] as [number, number];
    return { ...face, id: `${prefix}${String.fromCharCode(97 + index)}`, atMm: Math.round(face.atMm), fromMm: Math.round(face.fromMm), toMm: Math.round(face.toMm),
      free: subtract([face.fromMm, face.toMm], cuts).map(round), windows };
  });
}
