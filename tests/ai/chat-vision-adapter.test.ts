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
  it('a un proveedor que no aplica el esquema (APIMart, NodeClub…) se lo da también escrito en las instrucciones', async () => {
    let captured: { messages?: { role: string; content: { text?: string }[] }[] } = {};
    const f = setClientFactory(() => ({ chat: { completions: { create: (body: typeof captured) => {
      captured = body;
      return Promise.resolve({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    } } } }) as never);
    restoreFn = () => setClientFactory(f);
    const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
    const result = await new OpenRouterChatVisionAdapter({ apiKey: 'k', schemaInstruction: true }).chat({ ...baseReq, responseSchema: schema });
    expect(captured.messages?.[0]).toMatchObject({ role: 'system' });
    expect(captured.messages?.[0]?.content[0]?.text).toContain(JSON.stringify(schema));
    expect(result.structured).toEqual({ ok: true });
  });

  it('con la API de OpenAI usa sus campos (max_completion_tokens, reasoning_effort) y limita la espera', async () => {
    let captured: Record<string, unknown> = {}, options: { signal?: AbortSignal } | undefined;
    const f = setClientFactory(() => ({ chat: { completions: { create: (body: Record<string, unknown>, opts?: { signal?: AbortSignal }) => {
      captured = body; options = opts;
      return Promise.resolve({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    } } } }) as never);
    restoreFn = () => setClientFactory(f);
    await new OpenRouterChatVisionAdapter({ apiKey: 'k', openAiApi: true }).chat({ ...baseReq, model: 'gpt-5.2', maxTokens: 900, reasoning: { effort: 'low' } });
    expect(captured).toMatchObject({ model: 'gpt-5.2', max_completion_tokens: 900, reasoning_effort: 'low' });
    expect(captured).not.toHaveProperty('max_tokens');
    expect(captured).not.toHaveProperty('reasoning');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

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
      reasoning: { effort: 'low' },
    });

    const rf = captured.response_format as { type: string; json_schema: { strict: boolean } };
    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.strict).toBe(true);
    expect(captured.max_tokens).toBeGreaterThan(0); // call-limit aplicado
    expect(captured.reasoning).toEqual({ effort: 'low' });
    expect(result.structured).toEqual({ objetivo: 'reforma' });
    expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 7 });
  });

  it('rescata el JSON cuando el modelo lo envuelve en vallas markdown o prosa', async () => {
    const wrapped = 'Aquí tienes el resultado:\n```json\n{"objetivo":"reforma"}\n```\nEspero que sirva.';
    const f = setClientFactory(
      () =>
        ({
          chat: {
            completions: {
              create: () =>
                Promise.resolve({ choices: [{ message: { content: wrapped } }], usage: {} }),
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
    expect(result.structured).toEqual({ objetivo: 'reforma' });
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

  it('explica cuando el modelo agota la salida sin devolver JSON', async () => {
    const f = setClientFactory(() => ({ chat: { completions: { create: () => Promise.resolve({
      choices: [{ finish_reason: 'length', message: { content: null } }], usage: {},
    }) } } }) as never);
    restoreFn = () => setClientFactory(f);
    await expect(new OpenRouterChatVisionAdapter().chat({ ...baseReq, responseSchema: { type: 'object' } }))
      .rejects.toMatchObject({ kind: 'schema', message: expect.stringContaining('agotó el límite') });
  });

  it('explica el límite también cuando el JSON llega cortado a medias', async () => {
    const f = setClientFactory(() => ({ chat: { completions: { create: () => Promise.resolve({
      choices: [{ finish_reason: 'length', message: { content: '{"summary":"Casa","furniture":[{"catalogId":' } }], usage: {},
    }) } } }) as never);
    restoreFn = () => setClientFactory(f);
    await expect(new OpenRouterChatVisionAdapter().chat({ ...baseReq, responseSchema: { type: 'object' } }))
      .rejects.toMatchObject({ kind: 'schema', message: expect.stringContaining('agotó el límite') });
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
