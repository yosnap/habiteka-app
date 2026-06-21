/**
 * Rasteriza el documento del canvas a un PNG que sirve de imagen de referencia
 * para el render (CRL-4). Se hace en el SERVIDOR con `sharp` (vía SVG) en lugar
 * de exportar el stage de Konva en cliente: así la referencia es determinista y
 * NO arrastra la rejilla, el transformer ni las etiquetas de hover (que el modelo
 * copiaría literalmente al render, como mostró el prototipo).
 *
 * Solo geometría, SIN texto (el modelo copia las etiquetas al render). El PNG se
 * encuadra al bounding box de la sala y conserva su proporción real, para que el
 * render no salga cuadrado cuando el plano es apaisado. Los colores por familia
 * ayudan al modelo a distinguir tipos de elemento.
 */
import sharp from 'sharp';
import type { CanvasDoc, StructObj } from '@/canvas/types';

// Lado mayor del PNG; el otro se deriva de la proporción de la sala. Acotado para
// no inflar el payload base64 enviado al proveedor.
const MAX_SIDE = 1024;
const PADDING = 40; // margen alrededor de la sala, en px de stage.

export interface RasterResult {
  /** PNG del lienzo en base64 (sin el prefijo `data:`). */
  base64: string;
  /** Proporción ancho:alto de la sala, p. ej. '16:9' (para pedírsela al modelo). */
  aspectRatio: string;
}

/** Color de relleno por familia, para que el modelo distinga tipos de elemento. */
function fillFor(kind: StructObj['kind']): string {
  if (kind === 'wall') return '#3a322e';
  if (kind === 'window') return '#7db7e8';
  if (kind === 'door') return '#b07d4a';
  if (kind === 'sofa' || kind === 'cama' || kind === 'silla') return '#d8cdbd';
  if (kind === 'mesa' || kind === 'mesilla' || kind === 'encimera' || kind === 'isla')
    return '#c9a36a';
  if (kind === 'tv' || kind === 'ordenador') return '#2b2b2b';
  if (kind === 'lampara') return '#e8c86a';
  return '#cccccc';
}

/** Bounding box de la sala (muros) o, si no hay, de todos los objetos. */
function roomBounds(doc: CanvasDoc) {
  const src = doc.objects.filter((o) => o.kind === 'wall');
  const objs = src.length ? src : doc.objects;
  if (objs.length === 0) return { x: 0, y: 0, w: MAX_SIDE, h: MAX_SIDE };
  const minX = Math.min(...objs.map((o) => o.x));
  const minY = Math.min(...objs.map((o) => o.y));
  const maxX = Math.max(...objs.map((o) => o.x + o.width));
  const maxY = Math.max(...objs.map((o) => o.y + o.height));
  return { x: minX - PADDING, y: minY - PADDING, w: maxX - minX + 2 * PADDING, h: maxY - minY + 2 * PADDING };
}

/** Aproxima la proporción a una fracción simple legible para el proveedor. */
function toAspectRatio(w: number, h: number): string {
  const r = w / h;
  const candidates: Array<[string, number]> = [
    ['1:1', 1],
    ['4:3', 4 / 3],
    ['3:2', 3 / 2],
    ['16:9', 16 / 9],
    ['3:4', 3 / 4],
    ['2:3', 2 / 3],
    ['9:16', 9 / 16],
  ];
  return candidates.reduce((best, c) =>
    Math.abs(c[1] - r) < Math.abs(best[1] - r) ? c : best,
  )[0];
}

function docToSvg(doc: CanvasDoc, room: { x: number; y: number; w: number; h: number }): string {
  const rects = doc.objects
    .map((o) => {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      return `<g transform="rotate(${o.rotation} ${cx} ${cy})"><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="${fillFor(o.kind)}" stroke="#000" stroke-width="1.5" opacity="0.92"/></g>`;
    })
    .join('');
  // El viewBox encuadra la sala: el PNG conserva su proporción real.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${room.x} ${room.y} ${room.w} ${room.h}"><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="#ffffff"/>${rects}</svg>`;
}

/** Rasteriza el lienzo y devuelve el PNG base64 + la proporción de la sala. */
export async function rasterizeCanvasDoc(doc: CanvasDoc): Promise<RasterResult> {
  const room = roomBounds(doc);
  // El lado mayor manda; el otro escala con la proporción de la sala.
  const outW = room.w >= room.h ? MAX_SIDE : Math.round((room.w / room.h) * MAX_SIDE);
  const outH = room.h > room.w ? MAX_SIDE : Math.round((room.h / room.w) * MAX_SIDE);
  const png = await sharp(Buffer.from(docToSvg(doc, room)))
    .resize(outW, outH, { fit: 'fill' })
    .png()
    .toBuffer();
  return { base64: png.toString('base64'), aspectRatio: toAspectRatio(room.w, room.h) };
}
