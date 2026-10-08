import sharp from 'sharp';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { planRasterBounds } from './rasterize-editor-document';

type Image = { base64: string; mimeType: string };

/** Margen alrededor de la estancia: deja ver los huecos y el arranque de las estancias vecinas. */
const MARGIN_MM = 800;
const BACKGROUND = { r: 216, g: 216, b: 216, alpha: 1 };

/**
 * Cenital aceptada recortada a la estancia de una vista interior y girada para que la cámara mire hacia arriba: lo de
 * abajo queda cerca de la cámara y la izquierda y la derecha son las suyas. Sin ella, cada interior inventaba su propio
 * mobiliario y acabados, distintos de la cenital que el usuario había aceptado.
 *
 * La cenital se generó desde el plano con el encuadre de `planRasterBounds`, centrado en su formato de salida; así se
 * sabe dónde cae cada punto del plano sin adivinarlo en la imagen.
 */
export async function acceptedTopForInterior(identity: Image, document: EditorDocument, view: RenderView): Promise<Image> {
  if (!view.roomId || !view.focus) return identity;
  const level = buildingDocuments(document).find(item => item.id === (view.levelId ?? document.activeLevelId ?? 'ground'))?.document ?? document;
  const room = deriveRoomsSafe(level).find(item => item.id === view.roomId);
  if (!room) return identity;
  const buffer = Buffer.from(identity.base64, 'base64');
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  const bounds = planRasterBounds(level);
  if (!width || !height || bounds.width <= 0 || bounds.height <= 0) return identity;
  const planRatio = bounds.width / bounds.height, imageRatio = width / height;
  // El plano ocupa el centro de la imagen; el formato de salida añade franjas a los lados o arriba y abajo.
  const toPixel = (x: number, y: number) => {
    const u = (x - bounds.x) / bounds.width, v = (y - bounds.y) / bounds.height;
    return planRatio < imageRatio
      ? { x: (.5 + (u - .5) * planRatio / imageRatio) * width, y: v * height }
      : { x: u * width, y: (.5 + (v - .5) * imageRatio / planRatio) * height };
  };
  const xs = room.boundary.map(point => point.x), ys = room.boundary.map(point => point.y);
  const a = toPixel(Math.min(...xs) - MARGIN_MM, Math.min(...ys) - MARGIN_MM);
  const b = toPixel(Math.max(...xs) + MARGIN_MM, Math.max(...ys) + MARGIN_MM);
  const left = Math.max(0, Math.floor(a.x)), top = Math.max(0, Math.floor(a.y));
  const right = Math.min(width, Math.ceil(b.x)), bottom = Math.min(height, Math.ceil(b.y));
  if (right - left < 32 || bottom - top < 32) return identity;
  // Rumbo de la cámara en el plano (el eje z del 3D es el y del plano); 0° es hacia arriba de la cenital.
  const heading = Math.atan2(view.focus[0] - view.position[0], -(view.focus[2] - view.position[2])) * 180 / Math.PI;
  const cropped = await sharp(buffer).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
  const rotated = await sharp(cropped).rotate(-heading, { background: BACKGROUND }).png().toBuffer();
  return { base64: rotated.toString('base64'), mimeType: 'image/png' };
}
