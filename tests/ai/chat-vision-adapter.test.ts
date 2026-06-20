import { describe, it, expect, afterEach } from 'vitest';
import { OpenRouterChatVisionAdapter } from '@/server/ai/chat-vision-adapter';
import { setClientFactory } from '@/server/ai/client/gateway-client';
import { AiError } from '@/server/ai/errors';
import type { ChatRequest } from '@/lib/contracts';

// Los tests inyectan un doble determinista del SDK vía `setClientFactory`: cero
// red. Cada test captura el body enviado y devuelve una respuesta fija.

const baseReq: ChatRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }],
  model: 'anthropic/claude-3.7-sonnet',
};

let restoreFn: (() => void) | null = null;
afterEach(() => {
  restoreFn?.();
  restoreFn = null;
});

describe('OpenRouterChatVisionAdapter', () => {
  it('arma response_format json_schema strict y parsea la salida estructurada', async () => {
    let captured: Record<string, unknown> = {};
    const f = setClientFactory(
      () =>
        ({
          chat: {
            completions: {
              create: (body: Record<string, unknown>) => {
                captured = body;
                return Promise.resolve({
                  choices: [{ message: { content: '{"objetivo":"reforma"}' } }],
                  usage: { prompt_tokens: 5, completion_tokens: 7 },
                });
              },
            },
          },
        }) as never,
    );
    restoreFn = () => setClientFactory(f);

    const adapter = new OpenRouterChatVisionAdapter();
    const result = await adapter.chat({
      ...baseReq,
      responseSchema: { type: 'object', properties: { objetivo: { type: 'string' } } },
    });

    const rf = captured.response_format as { type: string; json_schema: { strict: boolean } };
    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.strict).toBe(true);
    expect(captured.max_tokens).toBeGreaterThan(0); // call-limit aplicado
    expect(result.structured).toEqual({ objetivo: 'reforma' });
    expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 7 });
  });

  it('JSON inválido con responseSchema lanza AiError(schema)', async () => {
    const f = setClientFactory(
      () =>
        ({
          chat: {
            completions: {
              create: () =>
                Promise.resolve({ choices: [{ message: { content: 'no-json' } }], usage: {} }),
            },
          },
        }) as never,
    );
    restoreFn = () => setClientFactory(f);

    const adapter = new OpenRouterChatVisionAdapter();
    await expect(
      adapter.chat({ ...baseReq, responseSchema: { type: 'object' } }),
    ).rejects.toMatchObject({ kind: 'schema' });
  });

  it('content_filter del proveedor lanza AiError(refusal)', async () => {
    const f = setClientFactory(
      () =>
        ({
          chat: {
            completions: {
              create: () =>
                Promise.resolve({
                  choices: [{ finish_reason: 'content_filter', message: { content: null } }],
                  usage: {},
                }),
            },
          },
        }) as never,
    );
    restoreFn = () => setClientFactory(f);

    const adapter = new OpenRouterChatVisionAdapter();
    await expect(adapter.chat(baseReq)).rejects.toMatchObject({ kind: 'refusal' });
  });

  it('fallbackModels se traduce a extra_body.models (primario + respaldos)', async () => {
    let captured: Record<string, unknown> = {};
    const f = setClientFactory(
      () =>
        ({
          chat: {
            completions: {
              create: (body: Record<string, unknown>) => {
                captured = body;
                return Promise.resolve({ choices: [{ message: { content: 'ok' } }], usage: {} });
              },
            },
          },
        }) as never,
    );
    restoreFn = () => setClientFactory(f);

    const adapter = new OpenRouterChatVisionAdapter();
    await adapter.chat({ ...baseReq, fallbackModels: ['openai/gpt-4o'] });
    expect(captured.models).toEqual(['anthropic/claude-3.7-sonnet', 'openai/gpt-4o']);
  });

  it('AiError es la clase exportada', () => {
    expect(new AiError('timeout', 'x')).toBeInstanceOf(Error);
  });
});
