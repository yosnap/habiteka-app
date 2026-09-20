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
  it('un 5xx del gateway se normaliza como gateway_down con la causa; los respaldos los resuelve la capa superior', async () => {
    const seenBaseURLs: Array<string | null> = [];
    const f = setClientFactory((spec) => { seenBaseURLs.push(spec.baseURL); return { fail: true } as never; });
    restore = () => setClientFactory(f);

    const cause = { status: 503 };
    await expect(withGatewayFallback({ baseURL: null, run: async () => { throw cause; } }))
      .rejects.toMatchObject({ kind: 'gateway_down', cause });
    // Solo se consulta el gateway configurado: no hay conmutación implícita por variable de entorno.
    expect(seenBaseURLs).toEqual([null]);
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
