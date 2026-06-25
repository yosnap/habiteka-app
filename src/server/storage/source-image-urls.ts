/**
 * Genera las URLs presignadas (vida corta) de un conjunto de imágenes de origen
 * a partir de su `key`. No se persiste la URL (caducaría): se resuelve al servir.
 *
 * Degrada a un mapa vacío si el storage no está disponible (p. ej. credenciales
 * ausentes en dev): la miniatura de origen es un extra y no debe tumbar la vista
 * que la usa (diseños/historial).
 */
import { getStorageAdapter } from './s3-storage-adapter';

export async function resolveSourceImageUrls(
  sourceImages: Array<{ id: string; key: string }>,
): Promise<Map<string, string>> {
  if (sourceImages.length === 0) return new Map();
  try {
    const storage = getStorageAdapter();
    const entries = await Promise.all(
      sourceImages.map(
        async (img) => [img.id, await storage.getPresignedDownloadUrl(img.key)] as const,
      ),
    );
    return new Map(entries);
  } catch {
    return new Map();
  }
}
