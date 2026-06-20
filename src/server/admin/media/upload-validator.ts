/**
 * Validación y saneado de una imagen subida al media manager.
 *
 * Reutiliza el saneador de imágenes de la capa de IA (DRY): valida el contenido
 * real por sus bytes (no por la extensión), limita dimensiones, elimina el EXIF
 * (privacidad/geolocalización) y re-codifica server-side. Devuelve el buffer ya
 * normalizado, listo para almacenar.
 */
import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';

export interface ValidatedImage {
  body: Buffer;
  contentType: 'image/png';
  width: number;
  height: number;
}

/** Valida y re-codifica un buffer de imagen para su almacenamiento. */
export async function validateUpload(buffer: Buffer): Promise<ValidatedImage> {
  const sanitized = await sanitizeImageBuffer(buffer);
  return {
    body: Buffer.from(sanitized.base64, 'base64'),
    contentType: 'image/png',
    width: sanitized.width,
    height: sanitized.height,
  };
}
