/**
 * Construye un `CanvasDoc` con el contorno de una habitación a partir de sus medidas
 * reales (F7.4, wizard guiado). Lógica PURA: parámetros → doc con los muros del contorno
 * + escala + altura de techo. Soporta rectángulo (compatibilidad) y formas no
 * rectangulares (L/U/T) delegando la geometría en `room-shapes.ts`. Para formas no
 * rectangulares el doc lleva además `floorOutline` (polígono del suelo) para el 3D.
 */
import type { CanvasDoc, FloorVertex, StructObj } from '../types';
import { CANVAS_SCHEMA_VERSION } from '../types';
import { DEFAULT_WALL_THICKNESS_M } from '../draw-wall';
import {
  buildShapeOutline,
  isValidShape,
  type RoomShape,
  type RoomShapeParams,
} from './room-shapes';

/** Escala por defecto del plano nuevo: 100 px = 1 m (ratio 1:100). */
const DEFAULT_PX_PER_METER = 100;
/** Origen del contorno en px (margen desde la esquina del lienzo). */
const ORIGIN_PX = 120;

export interface RoomParams {
  /** Ancho interior de la sala (m). */
  widthM: number;
  /** Largo/fondo interior de la sala (m). */
  lengthM: number;
  /** Altura de techo (m). */
  ceilingHeightM: number;
  /** Grosor de muro (m); por defecto 15 cm. */
  wallThicknessM?: number;
  /** Píxeles por metro; por defecto 100 (1:100). */
  pxPerMeter?: number;
}

/** ¿Los parámetros describen una sala rectangular válida (medidas positivas y finitas)? */
export function isValidRoom(p: RoomParams): boolean {
  return (
    Number.isFinite(p.widthM) &&
    Number.isFinite(p.lengthM) &&
    Number.isFinite(p.ceilingHeightM) &&
    p.widthM > 0 &&
    p.lengthM > 0 &&
    p.ceilingHeightM > 0
  );
}

/**
 * Ensambla un `CanvasDoc` a partir de los muros de un contorno ya calculados, la altura
 * de techo, la escala y (opcionalmente) el polígono del suelo. Núcleo común a todas las
 * formas: evita duplicar el armazón del doc.
 */
function assembleDoc(
  objects: StructObj[],
  ceilingHeightM: number,
  pxPerMeter: number,
  floorOutline?: FloorVertex[],
): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    scale: { pxPerMeter, ratio: 100 },
    ceilingHeightM,
    ...(floorOutline ? { floorOutline } : {}),
  };
}

/**
 * Genera el `CanvasDoc` de una sala RECTANGULAR (compatibilidad): 4 muros cuyo INTERIOR
 * mide `widthM × lengthM`. Reusa `room-shapes` para el contorno; el resultado coincide
 * exactamente con la geometría histórica (verificado por test de regresión). El rectángulo
 * NO lleva `floorOutline`: su suelo 3D se deriva del bbox de muros como siempre.
 */
export function buildRoomDoc(params: RoomParams): CanvasDoc {
  const pxPerMeter = params.pxPerMeter ?? DEFAULT_PX_PER_METER;
  const wallThicknessM = params.wallThicknessM ?? DEFAULT_WALL_THICKNESS_M;
  const { walls } = buildShapeOutline(
    { shape: 'rect', widthM: params.widthM, lengthM: params.lengthM },
    { x: ORIGIN_PX, y: ORIGIN_PX },
    pxPerMeter,
    wallThicknessM,
  );
  return assembleDoc(walls, params.ceilingHeightM, pxPerMeter);
}

/** Parámetros de una sala por forma + contexto de doc (altura, escala, grosor). */
export interface ShapeRoomParams {
  shape: RoomShapeParams;
  ceilingHeightM: number;
  wallThicknessM?: number;
  pxPerMeter?: number;
}

/** ¿La forma y el contexto del doc son válidos? */
export function isValidShapeRoom(p: ShapeRoomParams): boolean {
  return (
    Number.isFinite(p.ceilingHeightM) && p.ceilingHeightM > 0 && isValidShape(p.shape)
  );
}

/**
 * Genera el `CanvasDoc` de una sala de cualquier forma (rect, L, U, T). Para el rectángulo
 * delega en el mismo contorno que `buildRoomDoc` (sin `floorOutline`); para L/U/T añade el
 * polígono interior del suelo al doc, que el render 3D usa para dibujar un suelo exacto.
 */
export function buildShapeDoc(p: ShapeRoomParams): CanvasDoc {
  const pxPerMeter = p.pxPerMeter ?? DEFAULT_PX_PER_METER;
  const wallThicknessM = p.wallThicknessM ?? DEFAULT_WALL_THICKNESS_M;
  const { vertices, walls } = buildShapeOutline(
    p.shape,
    { x: ORIGIN_PX, y: ORIGIN_PX },
    pxPerMeter,
    wallThicknessM,
  );
  // El rectángulo conserva el comportamiento previo (suelo por bbox); las formas no
  // rectangulares aportan su polígono de suelo.
  const floorOutline = p.shape.shape === 'rect' ? undefined : vertices;
  return assembleDoc(walls, p.ceilingHeightM, pxPerMeter, floorOutline);
}

export type { RoomShape };
