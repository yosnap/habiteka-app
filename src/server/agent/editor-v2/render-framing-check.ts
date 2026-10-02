import sharp from 'sharp';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';

type Image = { base64: string; mimeType: string };
type Bounds = { x: number; y: number; width: number; height: number };

function distance(a: number[], b: number[]): number {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));
}

/** Detecta el contenido sobre un fondo uniforme; devuelve null en escenas sin fondo fiable. */
async function contentBounds(image: Image): Promise<Bounds | null> {
  const { data, info } = await sharp(Buffer.from(image.base64, 'base64'))
    .flatten({ background: '#ffffff' })
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixel = (x: number, y: number) => {
    const at = (y * width + x) * channels;
    return [data[at]!, data[at + 1]!, data[at + 2]!];
  };
  const inset = Math.max(2, Math.floor(Math.min(width, height) * 0.015));
  const corners = [pixel(inset, inset), pixel(width - inset - 1, inset),
    pixel(inset, height - inset - 1), pixel(width - inset - 1, height - inset - 1)];
  if (corners.some((corner) => distance(corner, corners[0]!) > 28)) return null;
  const background = [0, 1, 2].map((channel) =>
    corners.reduce((sum, corner) => sum + corner[channel]!, 0) / corners.length);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (distance(pixel(x, y), background) <= 48) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < width * height * 0.015 || xs.length > width * height * 0.75) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const low = Math.floor(xs.length * 0.005);
  const high = Math.ceil(xs.length * 0.995) - 1;
  const left = xs[low]! / width;
  const right = xs[high]! / width;
  const top = ys[low]! / height;
  const bottom = ys[high]! / height;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Detecta recortes o desplazamientos extremos; admite acercar la cámara para aprovechar el lienzo. */
export async function assertRenderFraming(capture: Image, candidate: Image): Promise<void> {
  const [source, output] = await Promise.all([contentBounds(capture), contentBounds(candidate)]);
  if (!source || !output) return;
  const ratio = (a: number, b: number) => Math.max(a / b, b / a);
  const sourceCenter = [source.x + source.width / 2, source.y + source.height / 2];
  const outputCenter = [output.x + output.width / 2, output.y + output.height / 2];
  if (ratio(source.width, output.width) > 2.2 || ratio(source.height, output.height) > 2.2
      || distance(sourceCenter, outputCenter) > 0.2) {
    throw new RenderRejectedError('Se descartó el diseño porque recortó o desplazó demasiado el inmueble en el encuadre.');
  }
}
