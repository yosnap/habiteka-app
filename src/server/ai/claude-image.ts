import sharp from 'sharp';
import type { MessagePart } from '@/lib/contracts';
import { aiError } from './errors';

/** Claude reduce internamente las imágenes más grandes: enviarlas mayores solo engorda la petición. */
export const CLAUDE_IMAGE_MAX_PX = 2000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Imagen lista para Claude a través de KIE: siempre en base64 (una URL firmada de nuestro almacenamiento no es accesible
 * desde fuera en local, y una URL `data:` no vale como fuente URL en la API de Anthropic), JPEG de como mucho 2000 px y
 * con fondo blanco donde había transparencia. Una petición con las imágenes originales superaba su límite (413).
 */
export async function prepareClaudeImage(part: Extract<MessagePart, { type: 'image_url' }>): Promise<{ type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }> {
  const source = await imageBytes(part);
  let jpeg: Buffer;
  try {
    jpeg = await sharp(source).rotate()
      .resize({ width: CLAUDE_IMAGE_MAX_PX, height: CLAUDE_IMAGE_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  } catch (error) {
    throw aiError('provider_down', 'No se pudo preparar una imagen para el modelo', error);
  }
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
}

async function imageBytes(part: Extract<MessagePart, { type: 'image_url' }>): Promise<Buffer> {
  if (part.base64) return Buffer.from(part.base64, 'base64');
  const url = part.url ?? '';
  const inline = /^data:[^;,]+;base64,(.+)$/.exec(url);
  if (inline) return Buffer.from(inline[1]!, 'base64');
  // Solo URLs que genera la aplicación (su almacenamiento o el del proveedor de imagen), nunca una del usuario.
  if (!/^https?:\/\//.test(url)) throw aiError('provider_down', 'Imagen sin datos para el modelo');
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw aiError('provider_down', 'No se pudo descargar una imagen para el modelo', error);
  }
  const size = Number(response.headers.get('content-length') ?? 0);
  if (!response.ok || size > MAX_DOWNLOAD_BYTES) throw aiError('provider_down', `No se pudo descargar una imagen para el modelo (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw aiError('provider_down', 'Una imagen para el modelo es demasiado grande');
  return bytes;
}
