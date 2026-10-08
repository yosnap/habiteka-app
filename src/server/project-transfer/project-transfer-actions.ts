'use server';

/**
 * Importar un proyecto exportado (`.habiteka`). El archivo puede pesar cientos de
 * MB, así que el navegador lo sube directo al almacenamiento con una URL firmada
 * y después el servidor lo procesa desde allí.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction, fail } from '@/server/errors/run-action';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { importProjectArchive } from './import-project';

const MAX_IMPORT_BYTES = 500 * 1024 * 1024;
const uploadPrefix = (organizationId: string) => `imports/uploads/${organizationId}/`;

/** Prepara la subida del archivo a importar. */
export async function startProjectImport(bytes: number) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    if (!Number.isFinite(bytes) || bytes <= 0) fail('Elige un archivo .habiteka.');
    if (bytes > MAX_IMPORT_BYTES) fail('El proyecto supera el tamaño máximo de importación (500 MB).');
    const key = `${uploadPrefix(ctx.organizationId)}${crypto.randomUUID()}.habiteka`;
    const uploadUrl = await getStorageAdapter().getPresignedUploadUrl(key, bytes, 'application/zip');
    return { key, uploadUrl };
  });
}

/** Crea el proyecto a partir del archivo ya subido y retira la copia subida. */
export async function finishProjectImport(key: string) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    if (typeof key !== 'string' || !key.startsWith(uploadPrefix(ctx.organizationId)) || key.includes('..'))
      fail('Esa subida no pertenece a tu cuenta.');
    const storage = getStorageAdapter();
    let archive: Buffer;
    try { archive = await storage.get(key); } catch { fail('No se encuentra el archivo subido. Vuelve a intentarlo.'); }
    try {
      const imported = await importProjectArchive(ctx, new Uint8Array(archive));
      revalidatePath('/proyectos');
      return imported;
    } finally {
      await storage.delete(key).catch(() => undefined);
    }
  });
}
