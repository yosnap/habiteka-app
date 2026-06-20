import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import sharp from 'sharp';
import { importFromUrl, deleteAsset } from '@/server/admin/media/media-ops';
import { createFolder, moveFolder, FolderCycleError } from '@/server/admin/media/folder-ops';
import { validateUpload } from '@/server/admin/media/upload-validator';
import { assertWithinQuota, QuotaExceededError } from '@/server/admin/media/quota';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeUser } from '../helpers/db';

const ADMIN = 'admin-1';

// Storage en memoria: registra las operaciones sin tocar S3/MinIO.
function fakeStorage(): { storage: StorageAdapter; puts: string[]; deletes: string[] } {
  const puts: string[] = [];
  const deletes: string[] = [];
  const storage: StorageAdapter = {
    put: async (input) => {
      puts.push(input.key);
    },
    delete: async (key) => {
      deletes.push(key);
    },
    getPresignedUploadUrl: async (key) => `https://storage.test/upload/${key}`,
    getPresignedDownloadUrl: async (key) => `https://storage.test/${key}`,
  };
  return { storage, puts, deletes };
}

async function pngBuffer(size = 32): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
}

describe('upload-validator', () => {
  it('sanea y re-codifica una imagen válida a PNG', async () => {
    const out = await validateUpload(await pngBuffer(48));
    expect(out.contentType).toBe('image/png');
    expect(out.width).toBe(48);
  });

  it('rechaza un buffer que no es imagen', async () => {
    await expect(validateUpload(Buffer.from('no soy imagen'))).rejects.toBeTruthy();
  });
});

describe('importFromUrl (cadena segura)', () => {
  beforeEach(async () => {
    await resetDb();
    await makeUser();
  });
  afterEach(() => vi.restoreAllMocks());

  it('importa una imagen pública: valida, almacena y registra el asset', async () => {
    const png = await pngBuffer(40);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(png), { status: 200 }) as unknown as Response,
    );
    const { storage, puts } = fakeStorage();

    const asset = await importFromUrl(storage, {
      actorId: ADMIN,
      url: 'https://cdn.ejemplo.com/foto.png',
    });

    expect(puts).toHaveLength(1);
    const row = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(row?.status).toBe('READY');
    expect(row?.mime).toBe('image/png');
    const audit = await prisma.auditLog.findFirst({ where: { action: 'import_media' } });
    expect(audit?.actorId).toBe(ADMIN);
  });

  it('rechaza una URL interna sin descargar (anti-SSRF)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { storage } = fakeStorage();
    await expect(
      importFromUrl(storage, { actorId: ADMIN, url: 'http://169.254.169.254/' }),
    ).rejects.toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('borra el asset del storage y su metadato', async () => {
    const png = await pngBuffer();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(png), { status: 200 }) as unknown as Response,
    );
    const { storage, deletes } = fakeStorage();
    const asset = await importFromUrl(storage, { actorId: ADMIN, url: 'https://cdn.test/a.png' });

    await deleteAsset(storage, ADMIN, asset.id);
    expect(deletes).toHaveLength(1);
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).toBeNull();
  });
});

describe('folder-ops (jerarquía anti-ciclo)', () => {
  beforeEach(async () => {
    await resetDb();
    await makeUser();
  });

  it('crea carpetas y permite mover a una rama no descendiente', async () => {
    const a = await createFolder(ADMIN, 'A');
    const b = await createFolder(ADMIN, 'B');
    await expect(moveFolder(ADMIN, b.id, a.id)).resolves.toBeUndefined();
  });

  it('rechaza mover una carpeta dentro de su propio descendiente', async () => {
    const a = await createFolder(ADMIN, 'A');
    const child = await createFolder(ADMIN, 'A-child', a.id);
    // Mover A dentro de su hijo crearía un ciclo.
    await expect(moveFolder(ADMIN, a.id, child.id)).rejects.toBeInstanceOf(FolderCycleError);
  });

  it('rechaza mover una carpeta dentro de sí misma', async () => {
    const a = await createFolder(ADMIN, 'A');
    await expect(moveFolder(ADMIN, a.id, a.id)).rejects.toBeInstanceOf(FolderCycleError);
  });
});

describe('quota', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.systemSetting.upsert({
      where: { key: 'media_max_total_bytes' },
      update: { value: 1000 },
      create: { key: 'media_max_total_bytes', value: 1000 },
    });
  });

  it('bloquea cuando se superaría la cuota de tamaño', async () => {
    await expect(assertWithinQuota(2000)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('permite cuando hay espacio', async () => {
    await expect(assertWithinQuota(500)).resolves.toBeUndefined();
  });
});
