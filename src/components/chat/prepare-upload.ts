import type { UploadedImage } from './image-upload';

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
    const base64 = canvas.toDataURL('image/png').split(',')[1]!;
    if ((base64.length * 3) / 4 > 10 * 1024 * 1024) {
      throw new Error('La imagen procesada supera 10 MB; usa una imagen más pequeña.');
    }
    return { base64, mimeType: 'image/png' };
  } finally {
    bitmap.close();
  }
}
