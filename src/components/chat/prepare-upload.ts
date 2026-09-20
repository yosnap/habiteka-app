import type { UploadedImage } from './image-upload';

/**
 * Presupuesto de caracteres base64 por petición. React Flight limita a 1e6 el
 * total de arrays y cadenas que decodifica en los argumentos de una Server
 * Action ("Maximum array nesting exceeded"); un PNG de plano a 2048 px lo
 * supera. Por debajo de este umbral cabe con margen para el resto de argumentos.
 */
export const MAX_ACTION_BASE64_CHARS = 900_000;

// Calidades JPEG que se prueban cuando el PNG no cabe: un plano de líneas
// sigue siendo nítido a 0,85 y la detección de muros tolera el antialiasing.
const JPEG_QUALITIES = [0.92, 0.85, 0.78, 0.7];

/**
 * Codifica el lienzo dentro del presupuesto: PNG sin pérdida si cabe; si no,
 * JPEG bajando la calidad y, en último recurso, reduciendo el lado mayor.
 */
export function canvasToBoundedImage(canvas: HTMLCanvasElement): UploadedImage {
  const png = canvas.toDataURL('image/png').split(',')[1]!;
  if (png.length <= MAX_ACTION_BASE64_CHARS) return { base64: png, mimeType: 'image/png' };
  for (const quality of JPEG_QUALITIES) {
    const jpeg = canvas.toDataURL('image/jpeg', quality).split(',')[1]!;
    if (jpeg.length <= MAX_ACTION_BASE64_CHARS) return { base64: jpeg, mimeType: 'image/jpeg' };
  }
  // Ni a baja calidad cabe: reducir el lado mayor un 25 % y reintentar.
  const smaller = document.createElement('canvas');
  smaller.width = Math.max(1, Math.round(canvas.width * 0.75));
  smaller.height = Math.max(1, Math.round(canvas.height * 0.75));
  const ctx = smaller.getContext('2d');
  if (!ctx || smaller.width < 400) throw new Error('La imagen es demasiado grande para procesarla; usa una más pequeña.');
  ctx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
  return canvasToBoundedImage(smaller);
}

/** Ajusta fotos de móvil al límite del servidor conservando su orientación visual. */
export async function prepareUpload(file: File): Promise<UploadedImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usa una imagen JPG, PNG o WebP.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la imagen.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvasToBoundedImage(canvas);
  } finally {
    bitmap.close();
  }
}
