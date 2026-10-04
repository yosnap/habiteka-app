import sharp from 'sharp';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderSpatialContext } from './render-spatial-context';
import type { CameraRoomGuide } from './render-camera-room-guide';

type Image = { base64: string; mimeType: string };
type Box = { left: number; top: number; right: number; bottom: number };

/**
 * Giro horario de la cenital (norte arriba) para que su borde inferior sea la fachada cortada más cercana a la cámara
 * y su izquierda y derecha coincidan con las del alzado. Sin girarla, la trasera aparecía invertida respecto de la
 * cenital y el auditor la descartaba aunque el orden fuera correcto.
 */
export const LATERAL_ROTATION: Record<string, number> = { front: 0, back: 180, left: 270, right: 90 };
/** Margen alrededor de los puntos de las estancias vistas, como fracción de la huella del inmueble. */
const MARGIN = .25;
/** Si las estancias vistas ocupan casi toda la planta, recortar no aporta nada. */
const MAX_CROP_SHARE = .85;

function planFootprint(document: EditorDocument): Box | null {
  const vertices = new Map(document.vertices.map(vertex => [vertex.id, vertex]));
  const points = document.walls.filter(wall => !wall.hidden)
    .flatMap(wall => [vertices.get(wall.startVertexId), vertices.get(wall.endVertexId)]).filter(point => point !== undefined);
  if (points.length < 2) return null;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/**
 * Estancias que la cámara ve de frente; las vistas solo a través de un hueco no amplían el recorte. Se usa el punto de
 * cada estancia y no su contorno: un paso abierto une a veces lavadero y pasillo en un polígono que cruza la casa.
 */
function seenRoomsBox(spatial: RenderSpatialContext, guide: CameraRoomGuide): Box | null {
  const seen = new Set(guide.rooms.filter(room => room.visibility !== 'through-opening').map(room => room.id));
  const points = spatial.levels.flatMap(level => level.rooms).filter(room => seen.has(room.id)).map(room => room.anchor);
  if (!points.length) return null;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Caja del inmueble en la cenital: lo que se separa del fondo liso que toman las esquinas. */
async function houseBoxInImage(buffer: Buffer): Promise<{ box: Box; width: number; height: number } | null> {
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  const scale = Math.min(1, 400 / Math.max(width, height));
  const { data, info } = await sharp(buffer).resize(Math.round(width * scale), Math.round(height * scale)).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [0, 1, 2].map(channel => data[(y * info.width + x) * 3 + channel]!);
  const corners = [pixel(0, 0), pixel(info.width - 1, 0), pixel(0, info.height - 1), pixel(info.width - 1, info.height - 1)];
  const background = [0, 1, 2].map(channel => corners.map(corner => corner[channel]!).sort((a, b) => a - b)[1]!);
  const columns = new Array<number>(info.width).fill(0), rows = new Array<number>(info.height).fill(0);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const [r, g, b] = pixel(x, y);
    if (Math.abs(r! - background[0]!) + Math.abs(g! - background[1]!) + Math.abs(b! - background[2]!) > 60) { columns[x]!++; rows[y]!++; }
  }
  // Una línea con pocos píxeles distintos es ruido o sombra, no fachada.
  const solid = (counts: number[], length: number) => counts.map((count, index) => count > length * .02 ? index : -1).filter(index => index >= 0);
  const xs = solid(columns, info.height), ys = solid(rows, info.width);
  if (!xs.length || !ys.length) return null;
  return { width, height, box: { left: xs[0]! / scale, right: (xs.at(-1)! + 1) / scale, top: ys[0]! / scale, bottom: (ys.at(-1)! + 1) / scale } };
}

/**
 * Prepara la cenital aceptada para un alzado: la recorta a las estancias que ve esa cámara y la gira a su orientación.
 * Con la planta entera delante, el generador llegó a sustituir el alzado por una vista elevada de toda la casa.
 */
export async function acceptedTopForView(identity: Image, preset: string, document: EditorDocument,
  spatial: RenderSpatialContext, guide?: CameraRoomGuide): Promise<Image> {
  let buffer: Buffer = Buffer.from(identity.base64, 'base64');
  const footprint = planFootprint(document), seen = guide ? seenRoomsBox(spatial, guide) : null;
  const house = footprint && seen ? await houseBoxInImage(buffer) : null;
  if (footprint && seen && house) {
    const spanX = footprint.right - footprint.left, spanY = footprint.bottom - footprint.top;
    const region = { left: Math.max(footprint.left, seen.left - spanX * MARGIN), right: Math.min(footprint.right, seen.right + spanX * MARGIN),
      top: Math.max(footprint.top, seen.top - spanY * MARGIN), bottom: Math.min(footprint.bottom, seen.bottom + spanY * MARGIN) };
    // La fachada cortada siempre entra completa: es el lado de la cámara.
    if (preset === 'front') region.bottom = footprint.bottom;
    if (preset === 'back') region.top = footprint.top;
    if (preset === 'left') region.left = footprint.left;
    if (preset === 'right') region.right = footprint.right;
    const share = (region.right - region.left) * (region.bottom - region.top) / (spanX * spanY);
    if (spanX > 0 && spanY > 0 && share < MAX_CROP_SHARE) {
      const toX = (x: number) => house.box.left + (x - footprint.left) / spanX * (house.box.right - house.box.left);
      const toY = (y: number) => house.box.top + (y - footprint.top) / spanY * (house.box.bottom - house.box.top);
      // Fuera de la huella se conserva el borde de la imagen para no cortar fachadas ni aleros.
      const left = Math.floor(region.left <= footprint.left ? 0 : toX(region.left));
      const top = Math.floor(region.top <= footprint.top ? 0 : toY(region.top));
      const right = Math.ceil(region.right >= footprint.right ? house.width : toX(region.right));
      const bottom = Math.ceil(region.bottom >= footprint.bottom ? house.height : toY(region.bottom));
      if (right - left > 16 && bottom - top > 16)
        buffer = await sharp(buffer).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
    }
  }
  const angle = LATERAL_ROTATION[preset] ?? 0;
  if (!angle && buffer.toString('base64') === identity.base64) return identity;
  return { base64: (await sharp(buffer).rotate(angle).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
}
