/**
 * Extracción de claves de object storage referenciadas por el contenido de una
 * organización. El borrado RGPD (art. 17) necesita la lista de objetos propios
 * en S3/MinIO para borrarlos de verdad, no solo las filas de la base de datos.
 *
 * Las refs viven en tres sitios: el `payload` de un Deliverable de tipo render
 * (`assetUrl`), el `resultRef` de una Iteration y la `key` de una SourceImage
 * (imagen de origen subida por el usuario). Se normaliza a "clave de bucket": si
 * es una URL, se toma su pathname sin la barra inicial; si ya es una clave, se
 * devuelve tal cual.
 */

/** Normaliza una ref (URL o clave) a clave de bucket, o null si no aplica. */
export function toStorageKey(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  try {
    // Si parsea como URL absoluta, la clave es el pathname sin la barra inicial.
    const url = new URL(trimmed);
    const key = url.pathname.replace(/^\/+/, '');
    return key || null;
  } catch {
    // No es URL: se asume que ya es una clave de bucket.
    return trimmed.replace(/^\/+/, '');
  }
}

/** Extrae la clave de storage de un payload de entregable, si lo es de render. */
export function storageKeyFromDeliverablePayload(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'type' in payload &&
    (payload as { type: unknown }).type === 'render3d' &&
    'assetUrl' in payload
  ) {
    return toStorageKey((payload as { assetUrl: unknown }).assetUrl as string);
  }
  return null;
}
