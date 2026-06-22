/**
 * Construye un `CanvasDoc` con el contorno de una habitación rectangular a partir de sus
 * medidas reales (F7.4, wizard guiado). Lógica PURA: parámetros → doc con 4 muros + escala
 * + altura de techo. El wizard la usa para generar la sala inicial; reusa `scale.ts` para la
 * conversión metros→px.
 */
import type { CanvasDoc, StructObj } from '../types';
import { CANVAS_SCHEMA_VERSION } from '../types';
import { metersToPx } from '../scale';
import { DEFAULT_WALL_THICKNESS_M } from '../draw-wall';

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

/** ¿Los parámetros describen una sala válida (medidas positivas y finitas)? */
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

function wall(id: string, x: number, y: number, width: number, height: number): StructObj {
  return { id, kind: 'wall', x, y, width, height, rotation: 0 };
}

/**
 * Genera el `CanvasDoc` de una sala rectangular: 4 muros formando el contorno cuyo INTERIOR
 * mide `widthM × lengthM`, con la escala y la altura de techo dadas. Los muros se colocan por
 * fuera del rectángulo interior (el grosor crece hacia afuera), de modo que el espacio útil
 * coincide con las medidas pedidas.
 */
export function buildRoomDoc(params: RoomParams): CanvasDoc {
  const pxPerMeter = params.pxPerMeter ?? DEFAULT_PX_PER_METER;
  const scale = { pxPerMeter };
  const thicknessM = params.wallThicknessM ?? DEFAULT_WALL_THICKNESS_M;
  const t = metersToPx(thicknessM, scale);
  const w = metersToPx(params.widthM, scale); // ancho interior (px)
  const l = metersToPx(params.lengthM, scale); // largo interior (px)
  const x0 = ORIGIN_PX;
  const y0 = ORIGIN_PX;

  // Contorno: los muros rodean el rectángulo interior [x0,y0]–[x0+w, y0+l].
  // Top y bottom abarcan todo el ancho incluyendo las esquinas (w + 2·t).
  const objects: StructObj[] = [
    wall('wall-top', x0 - t, y0 - t, w + 2 * t, t),
    wall('wall-bottom', x0 - t, y0 + l, w + 2 * t, t),
    wall('wall-left', x0 - t, y0, t, l),
    wall('wall-right', x0 + w, y0, t, l),
  ];

  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    scale: { pxPerMeter, ratio: 100 },
    ceilingHeightM: params.ceilingHeightM,
  };
}
