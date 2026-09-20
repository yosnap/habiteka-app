import { describe, it, expect } from 'vitest';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { setStorageAdapter } from '@/server/storage/s3-storage-adapter';
import type { StorageAdapter } from '@/server/storage/storage-adapter';

function fakeStorage(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    async put() {},
    async delete() {},
    async get() {
      return Buffer.alloc(0);
    },
    async getPresignedUploadUrl() {
      return 'upload';
    },
    async getPresignedDownloadUrl(key: string) {
      return `https://signed.test/${key}?fresh=1`;
    },
    ...overrides,
  };
}

describe('resolveRenderUrl — re-firma del render al servir', () => {
  it('re-firma una URL fresca desde assetKey (la presignada guardada caduca)', async () => {
    setStorageAdapter(fakeStorage());
    const url = await resolveRenderUrl({
      assetKey: 'renders/nano-banana/abc.png',
      assetUrl: 'http://localhost:9000/habiteka-dev/renders/nano-banana/abc.png?caducada',
    });
    expect(url).toBe('https://signed.test/renders/nano-banana/abc.png?fresh=1');
  });

  it('sin assetKey (fila antigua/URL remota) usa la assetUrl guardada', async () => {
    setStorageAdapter(fakeStorage());
    const url = await resolveRenderUrl({ assetUrl: 'https://remoto.test/r.png' });
    expect(url).toBe('https://remoto.test/r.png');
  });

  it('si el storage falla al re-firmar, degrada a la assetUrl en vez de romper', async () => {
    setStorageAdapter(
      fakeStorage({
        async getPresignedDownloadUrl() {
          throw new Error('storage caído');
        },
      }),
    );
    const url = await resolveRenderUrl({ assetKey: 'k', assetUrl: 'https://fallback.test/r.png' });
    expect(url).toBe('https://fallback.test/r.png');
  });

  it('sin ref devuelve null', async () => {
    expect(await resolveRenderUrl(null)).toBeNull();
  });
});
