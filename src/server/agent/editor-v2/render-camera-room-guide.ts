import sharp from 'sharp';
import { PerspectiveCamera, Vector3 } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { floorFinish } from '@/lib/editor-document/floor-finishes';
import { spatialLevels, type RenderSpatialContext } from './render-spatial-context';
import { renderRoomVisibility } from './render-room-visibility';
import type { RenderReferenceImage } from './render-reference-frame';

export interface CameraRoomLabel { id: string; name: string; x: number; y: number; visibility?: 'direct' | 'through-opening' }
export interface CameraRoomGuide { rooms: CameraRoomLabel[]; image?: { base64: string; mimeType: 'image/png' } }
export interface CameraImageFrame {
  sourceWidth: number; sourceHeight: number;
  crop: { left: number; top: number; width: number; height: number };
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Los rótulos se separan sin mover el punto que identifica cada estancia. */
export function cameraRoomLabelLayout(rooms: CameraRoomLabel[], frame: { width: number; height: number }) {
  const font = Math.max(12, Math.round(frame.width / 110)), gap = 6, padding = 6;
  const labels: { room: CameraRoomLabel; caption: string; left: number; top: number; width: number; height: number; font: number }[] = [];
  for (const room of rooms) {
    const caption = room.visibility === 'through-opening' ? `${room.name} · al fondo` : room.name;
    // Cota conservadora del texto; el SVG lo ajusta al ancho reservado si el nombre es muy largo.
    const textWidth = Array.from(caption).reduce((sum, char) => sum + font * (char.codePointAt(0)! > 0x2ff ? 1 : .7), 0);
    const width = Math.min(frame.width - gap * 2, Math.ceil(textWidth) + padding * 2), height = font + padding * 2;
    const left = Math.max(gap, Math.min(frame.width - width - gap, room.x * frame.width - width / 2));
    const base = room.y * frame.height - height - 10;
    const positions = [0, ...Array.from({ length: rooms.length + 1 }, (_, i) => [-(i + 1), i + 1]).flat()];
    const top = positions.map(offset => Math.max(gap, Math.min(frame.height - height - gap, base + offset * (height + gap))))
      .find(y => rooms.every(point => point.x * frame.width < left - gap || point.x * frame.width > left + width + gap ||
        point.y * frame.height < y - gap || point.y * frame.height > y + height + gap) &&
        labels.every(other => left + width + gap <= other.left || other.left + other.width + gap <= left ||
          y + height + gap <= other.top || other.top + other.height + gap <= y));
    // Si no cabe un rótulo legible, su nombre y coordenadas siguen en el contexto textual.
    if (top !== undefined) labels.push({ room, caption, left, top, width, height, font });
  }
  return labels;
}

/** Proyecta los nombres donde se ven, sin trasladar las habitaciones del fondo al primer plano. */
export function cameraRoomLabels(document: EditorDocument, view: RenderView, context: RenderSpatialContext,
  frame: CameraImageFrame, output: { width: number; height: number }): CameraRoomLabel[] {
  const camera = new PerspectiveCamera(view.fov, view.aspect, .01, 10000);
  camera.position.fromArray(view.position); camera.quaternion.fromArray(view.quaternion); camera.updateMatrixWorld(true);
  const visible = renderRoomVisibility(document, view);
  const visibleWithoutOpenings = renderRoomVisibility(document, view, { closeOpenings: true });
  const levels = spatialLevels(document, view), labels: CameraRoomLabel[] = [];
  for (const level of levels) {
    const rooms = deriveRoomsSafe(level.document);
    for (const room of context.levels.find(item => item.id === level.id)?.rooms ?? []) {
      const derived = rooms.find(item => pointInPolygon(room.anchor, item.boundary));
      const elevation = (view.allLevels ? level.elevationMm : 0) + (derived ? floorFinish(level.document, derived.id).elevationMm ?? 0 : 0);
      // El nombre identifica un punto interior, no certifica la visibilidad de toda la estancia.
      const world = new Vector3(room.anchor.x / 1000, elevation / 1000 + .5, room.anchor.y / 1000);
      const projected = world.clone().project(camera);
      if (projected.z < -1 || projected.z > 1 || !visible(world)) continue;
      const x = (projected.x + 1) / 2 * frame.sourceWidth - frame.crop.left;
      const y = (1 - projected.y) / 2 * frame.sourceHeight - frame.crop.top;
      if (x < 0 || y < 0 || x >= frame.crop.width || y >= frame.crop.height) continue;
      labels.push({ id: room.id, name: room.name, visibility: visibleWithoutOpenings(world) ? 'direct' : 'through-opening',
        x: (x + Math.floor((output.width - frame.crop.width) / 2)) / output.width,
        y: (y + Math.floor((output.height - frame.crop.height) / 2)) / output.height });
    }
  }
  return labels.sort((a, b) => a.x - b.x);
}

/** Copia anotada de la MISMA captura: nunca incorpora otra perspectiva. */
export async function renderCameraRoomGuide(document: EditorDocument, view: RenderView, context: RenderSpatialContext,
  reference: RenderReferenceImage, frame: CameraImageFrame, mask?: RenderReferenceImage): Promise<CameraRoomGuide> {
  let rooms = cameraRoomLabels(document, view, context, frame, reference);
  if (mask) {
    const bytes = await sharp(Buffer.from(mask.base64, 'base64')).removeAlpha().greyscale().raw().toBuffer();
    rooms = rooms.filter(room => bytes[Math.floor(room.y * mask.height) * mask.width + Math.floor(room.x * mask.width)]! >= 128);
  }
  if (!rooms.length) return { rooms };
  const annotations = cameraRoomLabelLayout(rooms, reference).map(({ room, caption, left, top, width, height, font }) => {
    const x = room.x * reference.width, y = room.y * reference.height;
    const edgeY = y < top ? top : top + height;
    const fit = caption.length * font > reference.width - 24 ? ` textLength="${width - 12}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<g><line x1="${x}" y1="${y}" x2="${left + width / 2}" y2="${edgeY}" stroke="#fff" stroke-width="4"/><line x1="${x}" y1="${y}" x2="${left + width / 2}" y2="${edgeY}" stroke="#075c46" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="4" fill="#075c46"/><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="4" fill="#fff" fill-opacity=".9"/><text x="${left + width / 2}" y="${top + height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${font}" font-family="sans-serif" font-weight="bold" fill="#075c46"${fit}>${escape(caption)}</text></g>`;
  }).join('');
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${reference.width}" height="${reference.height}">${annotations}</svg>`;
  const png = await sharp(Buffer.from(reference.base64, 'base64')).composite([{ input: Buffer.from(overlay) }]).png().toBuffer();
  return { rooms, image: { base64: png.toString('base64'), mimeType: 'image/png' } };
}
