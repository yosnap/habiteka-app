/**
 * Persistencia de la imagen de origen subida por el usuario en la ingesta.
 *
 * Cadena segura (mismo deber RGPD que enviar la imagen a la IA): minimizar (strip
 * de EXIF/geolocalización + re-codificación), almacenar el binario en el object
 * storage y registrar la fila con scope de organización. La escritura de la fila
 * pasa SIEMPRE por `withOrg(ctx).sourceImages.create`, que verifica la pertenencia
 * del proyecto (anti-IDOR); este módulo solo añade la parte de imagen/storage.
 *
 * El blur de caras (detector inyectado) NO se cablea aquí a propósito: igual que el
 * resto del flujo de imágenes del proyecto, el detector real (`@vladmandic/human`)
 * es una dependencia opcional que no se importa desde el grafo de una página (no
 * está en el bundle). `faceBlurred` queda en false hasta que se inyecte el detector
 * en un entorno que lo soporte. La clave de storage lleva el `organizationId` por
 * delante para facilitar el barrido de retención.
 */
import type { ScopedRepo } from '@/server/db/scoped-repo';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { scrubImageForAi } from '@/server/privacy/pii-scrub';

export interface PersistSourceImageInput {
  organizationId: string;
  projectId: string;
  /** Bytes de la imagen subida por el usuario (sin sanear todavía). */
  body: Buffer;
}

export interface PersistSourceImageResult {
  id: string;
  faceBlurred: boolean;
}

/**
 * Sanea (strip de EXIF + re-codificación a PNG), almacena y registra una imagen de
 * origen. Devuelve su id y si se difuminaron caras (hoy siempre false: el detector
 * de caras no se cablea en este flujo, ver nota de cabecera).
 */
export async function persistSourceImage(
  repo: ScopedRepo,
  storage: StorageAdapter,
  input: PersistSourceImageInput,
): Promise<PersistSourceImageResult> {
  // Sin detector inyectado: minimización por strip de EXIF (política 'continue').
  const sanitized = await scrubImageForAi(input.body);
  const faceBlurred = false;

  const body = Buffer.from(sanitized.base64, 'base64');
  const key = `source-images/${input.organizationId}/${globalThis.crypto.randomUUID()}.png`;
  await storage.put({ key, body, contentType: sanitized.mimeType });

  // Solo se persiste la `key`: la URL para mostrar la imagen se genera presignada
  // al servir (persistirla la dejaría caducada). Ver M1 del code-review.
  const { id } = await repo.sourceImages.create(input.projectId, {
    key,
    mime: sanitized.mimeType,
    width: sanitized.width,
    height: sanitized.height,
    role: 'PRIMARY',
    faceBlurred,
  });

  return { id, faceBlurred };
}
