import { describe, it, expect, afterEach } from 'vitest';
import { withGatewayFallback } from '@/server/ai/client/gateway-fallback';
import { setClientFactory } from '@/server/ai/client/gateway-client';

let restore: (() => void) | null = null;
const prevFallback = process.env.OPENROUTER_FALLBACK_BASE_URL;

afterEach(() => {
  restore?.();
  restore = null;
  if (prevFallback === undefined) delete process.env.OPENROUTER_FALLBACK_BASE_URL;
  else process.env.OPENROUTER_FALLBACK_BASE_URL = prevFallback;
});

describe('withGatewayFallback (OpenRouter es SPOF)', () => {
  it('conmuta al gateway secundario cuando el primario devuelve 5xx', async () => {
    process.env.OPENROUTER_FALLBACK_BASE_URL = 'https://secundario.example/api/v1';
    const seenBaseURLs: Array<string | undefined> = [];

    const f = setClientFactory((spec) => {
      seenBaseURLs.push(spec.baseURL ?? 'primario');
      const isPrimary = spec.baseURL === null;
      return {
        // El cliente primario "cae" con 5xx; el secundario responde.
        marker: isPrimary ? 'primary' : 'secondary',
        fail: isPrimary,
      } as never;
    });
    restore = () => setClientFactory(f);

    const result = await withGatewayFallback({
      baseURL: null,
      run: async (client) => {
        const c = client as unknown as { marker: string; fail: boolean };
        if (c.fail) throw { status: 503 };
        return c.marker;
      },
    });

    expect(result).toBe('secondary');
    expect(seenBaseURLs).toContain('primario');
  });

  it('sin secundario configurado, un 5xx primario lanza AiError(gateway_down)', async () => {
    delete process.env.OPENROUTER_FALLBACK_BASE_URL;
    const f = setClientFactory(() => ({}) as never);
    restore = () => setClientFactory(f);

    await expect(
      withGatewayFallback({
        baseURL: null,
        run: async () => {
          throw { status: 500 };
        },
      }),
    ).rejects.toMatchObject({ kind: 'gateway_down' });
  });

  it('un error NO 5xx (p. ej. 400) se propaga sin conmutar', async () => {
    const f = setClientFactory(() => ({}) as never);
    restore = () => setClientFactory(f);

    await expect(
      withGatewayFallback({
        baseURL: null,
        run: async () => {
          throw { status: 400, message: 'bad request' };
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
