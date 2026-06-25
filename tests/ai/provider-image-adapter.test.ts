import { describe, it, expect } from 'vitest';
import { ProviderImageAdapter } from '@/server/ai/image/provider-image-adapter';
import { ImagenImageProvider } from '@/server/ai/image/providers/stubs';
import type { ImageProvider } from '@/server/ai/image/providers/image-provider';

// Proveedor fake determinista: devuelve un asset y coste por imagen. Cero red.
const fakeProvider: ImageProvider = {
  id: 'fake',
  generate: async () => ({
    assetUrl: 'https://cdn.test/a.png',
    cost: { amountUsd: 0.04, unit: 'image' },
  }),
  inpaint: async () => ({
    assetUrl: 'https://cdn.test/b.png',
    cost: { amountUsd: 0.04, unit: 'image' },
  }),
};

describe('ProviderImageAdapter', () => {
  it('generate delega en el proveedor y devuelve assetUrl + coste por imagen', async () => {
    const adapter = new ProviderImageAdapter(fakeProvider);
    const result = await adapter.generate({ prompt: 'salón nórdico' });
    expect(result.assetUrl).toBe('https://cdn.test/a.png');
    expect(result.cost.unit).toBe('image');
  });

  it('rechaza dimensiones excesivas declaradas en aspectRatio WxH antes del proveedor', async () => {
    const adapter = new ProviderImageAdapter(fakeProvider);
    await expect(adapter.generate({ prompt: 'x', aspectRatio: '4096x4096' })).rejects.toMatchObject(
      {
        kind: 'call_limit',
      },
    );
  });

  it('el proveedor Imagen (no implementado) falla de forma explícita', async () => {
    const adapter = new ProviderImageAdapter(new ImagenImageProvider());
    await expect(adapter.generate({ prompt: 'x' })).rejects.toMatchObject({
      kind: 'provider_down',
    });
  });
});
