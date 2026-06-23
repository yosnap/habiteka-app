/**
 * URL fresca para mostrar un render. El render se guarda con una `assetKey` estable
 * en el object storage; la `assetUrl` del payload es una presignada que CADUCA (10
 * min), así que mostrarla tal cual deja la imagen rota en visitas posteriores. Aquí
 * se re-firma desde la key al servir, como ya se hace con las imágenes de origen.
 *
 * Degrada a la `assetUrl` guardada si no hay key (filas antiguas / URL remota) o si
 * el storage no está disponible: nunca rompe la vista por esto.
 */
import { getStorageAdapter } from './s3-storage-adapter';

export interface RenderRef {
  assetUrl?: string;
  assetKey?: string;
}

/** Re-firma la URL de un render desde su `assetKey`; si no hay, usa la guardada. */
export async function resolveRenderUrl(ref: RenderRef | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.assetKey) {
    try {
      return await getStorageAdapter().getPresignedDownloadUrl(ref.assetKey);
    } catch {
      return ref.assetUrl ?? null;
    }
  }
  return ref.assetUrl ?? null;
}
