/**
 * Saneado de imágenes de entrada antes de enviarlas a un modelo de visión.
 *
 * Defensa frente a varios vectores: se valida el tipo por los bytes mágicos (no
 * por el MIME declarado), se limita el tamaño y las dimensiones (anti
 * decompression-bomb), se elimina el EXIF y se re-codifica server-side. Además se
 * prohíbe pasar una URL externa arbitraria del usuario: el proveedor la
 * descargaría (riesgo SSRF), así que solo se admite un buffer propio.
 */
import sharp from 'sharp';
import { aiError } from '../errors';
import { MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION, assertImageBytes } from '../call-limits';

// Firmas de los formatos admitidos (primeros bytes del archivo).
const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" (contenedor WebP)
];

function detectMime(buf: Buffer): string | null {
  for (const sig of MAGIC) {
    if (sig.bytes.every((b, i) => buf[i] === b)) return sig.mime;
  }
  return null;
}

export interface SanitizedImage {
  base64: string;
  mimeType: 'image/png';
  width: number;
  height: number;
}

/**
 * Valida y re-codifica un buffer de imagen a PNG sin metadatos. Lanza
 * `AiError('sanitizer' | 'call_limit')` ante bytes no reconocidos o tamaños
 * excesivos.
 */
export async function sanitizeImageBuffer(buf: Buffer): Promise<SanitizedImage> {
  assertImageBytes(buf.byteLength);

  if (detectMime(buf) === null) {
    throw aiError('sanitizer', 'Formato de imagen no reconocido por sus bytes');
  }

  // Lee solo la cabecera (sin decodificar pixels) para validar dimensiones con un
  // error propio ANTES de decodificar — así una imagen-bomba se rechaza con
  // `call_limit`, no con el error genérico de sharp.
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) {
    throw aiError('sanitizer', 'No se pudieron leer las dimensiones de la imagen');
  }
  if (meta.width > MAX_IMAGE_DIMENSION || meta.height > MAX_IMAGE_DIMENSION) {
    throw aiError('call_limit', 'Imagen sobre el máximo de dimensiones');
  }

  // Re-codificar a PNG elimina EXIF/metadatos y normaliza el contenido. El límite
  // de pixels protege el decodificado de cualquier resto inesperado.
  const out = await sharp(buf, { limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION })
    .png()
    .toBuffer();
  assertImageBytes(out.byteLength);

  return {
    base64: out.toString('base64'),
    mimeType: 'image/png',
    width: meta.width,
    height: meta.height,
  };
}

/**
 * Rechaza explícitamente una URL externa aportada por el usuario: el proveedor de
 * visión la fetchearía (SSRF). Solo se permiten assets propios ya saneados.
 */
export function rejectExternalImageUrl(): never {
  throw aiError('sanitizer', 'No se admiten URLs de imagen externas (anti-SSRF)');
}

export { MAX_IMAGE_BYTES };
