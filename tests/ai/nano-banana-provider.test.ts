import { describe, it, expect, vi, afterEach } from 'vitest';
import { NanoBananaImageProvider } from '@/server/ai/image/providers/nano-banana';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA=';

function mockFetchOk(imageUrl: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { images: [{ image_url: { url: imageUrl } }] } }],
    }),
  });
}

afterEach(() => vi.restoreAllMocks());

describe('NanoBananaImageProvider (OpenRouter, sin red real)', () => {
  it('generate extrae la imagen de la respuesta y, sin storage, devuelve el data URL', async () => {
    vi.stubGlobal('fetch', mockFetchOk(PNG_DATA_URL));
    const provider = new NanoBananaImageProvider('test-key');

    const result = await provider.generate({ prompt: 'salón nórdico' });

    expect(result.assetUrl).toBe(PNG_DATA_URL);
    expect(result.cost.unit).toBe('image');
    // Pidió generación de imagen vía OpenRouter chat completions con modalities.
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call?.[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.model).toBe('google/gemini-2.5-flash-image');
    expect(body.modalities).toEqual(['text', 'image']);
  });

  it('con storage, sube el base64 y devuelve la URL de descarga', async () => {
    vi.stubGlobal('fetch', mockFetchOk(PNG_DATA_URL));
    const put = vi.fn().mockResolvedValue(undefined);
    const storage = {
      put,
      delete: vi.fn(),
      getPresignedUploadUrl: vi.fn(),
      getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://cdn.test/render.png'),
    };
    const provider = new NanoBananaImageProvider('test-key', storage);

    const result = await provider.generate({ prompt: 'x' });

    expect(put).toHaveBeenCalledOnce();
    expect(result.assetUrl).toBe('https://cdn.test/render.png');
  });

  it('si la respuesta no trae imagen, falla con provider_down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: {} }] }) }),
    );
    const provider = new NanoBananaImageProvider('test-key');
    await expect(provider.generate({ prompt: 'x' })).rejects.toMatchObject({
      kind: 'provider_down',
    });
  });
});
