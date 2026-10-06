import { describe, it, expect, afterEach } from 'vitest';
import { APIUserAbortError } from 'openai';
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

  it('normaliza un 429 como límite temporal para activar la ruta de respaldo', async () => {
    const f = setClientFactory(() => ({}) as never);
    restore = () => setClientFactory(f);
    const cause = { status: 429, message: 'concurrency limit' };
    await expect(withGatewayFallback({ baseURL: null, run: async () => { throw cause; } }))
      .rejects.toMatchObject({ kind: 'rate_limit', cause });
  });

  it('un modelo que no responde a tiempo pasa al respaldo con un aviso claro', async () => {
    const f = setClientFactory(() => ({}) as never);
    restore = () => setClientFactory(f);
    // Como lo lanza el SDK al vencer la señal de espera: su clase, sin `name` propio.
    const cause = new APIUserAbortError();
    await expect(withGatewayFallback({ baseURL: null, apiKey: 'k', run: async () => { throw cause; } }))
      .rejects.toMatchObject({ kind: 'timeout', message: 'El modelo no respondió en 3 minutos' });
  });

  it('sin saldo (402) avisa claro y deja pasar al respaldo configurado', async () => {
    const f = setClientFactory(() => ({}) as never);
    restore = () => setClientFactory(f);
    const cause = { status: 402, message: 'requires more credits' };
    await expect(withGatewayFallback({ baseURL: null, run: async () => { throw cause; } }))
      .rejects.toMatchObject({ kind: 'provider_down', cause, message: expect.stringContaining('sin saldo') });
  });
});
