/**
 * Claude en KIE habla el formato de mensajes de Anthropic: sistema aparte, imágenes como bloques base64, JSON obligado
 * con una herramienta (KIE no aplica `output_config`) y coste en créditos. Los errores se traducen como en el resto de proveedores para que entre el respaldo.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { AnthropicMessagesAdapter } from '@/server/ai/anthropic-messages-adapter';
import { prepareClaudeImage } from '@/server/ai/claude-image';
import type { ChatRequest } from '@/lib/contracts';

const adapter = () => new AnthropicMessagesAdapter({ baseURL: 'https://api.kie.ai/claude', apiKey: 'kie-key' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// Un plano grande con fondo transparente: debe llegar como JPEG de 2000 px como mucho y con fondo blanco.
let plan = '';
beforeAll(async () => {
  plan = (await sharp({ create: { width: 3000, height: 1500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()).toString('base64');
});
const request = (): ChatRequest => ({
  model: 'claude-sonnet-5', maxTokens: 900,
  messages: [
    { role: 'system', content: [{ type: 'text', text: 'Lee el plano.' }] },
    { role: 'user', content: [{ type: 'text', text: 'Este es el boceto' }, { type: 'image_url', base64: plan, mimeType: 'image/png' }] },
  ],
  responseSchema: { type: 'object', properties: { estancias: { type: 'number' } }, required: ['estancias'], additionalProperties: false },
});
const sizeOf = async (base64: string) => {
  const { width, height, format } = await sharp(Buffer.from(base64, 'base64')).metadata();
  const [r, g, b] = (await sharp(Buffer.from(base64, 'base64')).raw().toBuffer()).subarray(0, 3);
  return { width, height, format, corner: [r, g, b] };
};
afterEach(() => vi.restoreAllMocks());

describe('AnthropicMessagesAdapter (Claude en KIE)', () => {
  it('envía sistema e imagen en base64, obliga el JSON con una herramienta y devuelve sus argumentos con el coste en créditos', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'structured_output', input: { estancias: 7 } }], stop_reason: 'tool_use', credits_consumed: 0.25,
      usage: { input_tokens: 1200, output_tokens: 30 },
    }));
    const result = await adapter().chat(request());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.kie.ai/claude/v1/messages');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer kie-key');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      model: 'claude-sonnet-5', max_tokens: 900, stream: false,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Este es el boceto' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } }] }],
      tools: [{ name: 'structured_output', input_schema: request().responseSchema }],
      tool_choice: { type: 'tool', name: 'structured_output' },
    });
    expect(body.system).toMatch(/^Lee el plano\.\n\nDa el resultado llamando a la herramienta structured_output/);
    expect(body).not.toHaveProperty('output_config');
    expect(await sizeOf(body.messages[0].content[1].source.data)).toEqual({ width: 2000, height: 1000, format: 'jpeg', corner: [255, 255, 255] });
    expect(result).toMatchObject({ structured: { estancias: 7 }, toolCalls: undefined, usage: { promptTokens: 1200, completionTokens: 30, reportedCostUsd: 0.00125 } });
  });

  it('una imagen como data: URL o como URL firmada de nuestro almacenamiento llega a Claude en base64', async () => {
    const small = (await sharp({ create: { width: 40, height: 20, channels: 3, background: '#808080' } }).png().toBuffer()).toString('base64');
    expect(await sizeOf((await prepareClaudeImage({ type: 'image_url', url: `data:image/png;base64,${small}` })).source.data)).toMatchObject({ width: 40, height: 20, format: 'jpeg' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(Buffer.from(small, 'base64'), { status: 200 }));
    expect(await sizeOf((await prepareClaudeImage({ type: 'image_url', url: 'http://localhost:9000/habiteka/render.png?X-Amz-Signature=x' })).source.data)).toMatchObject({ width: 40, format: 'jpeg' });
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:9000/habiteka/render.png?X-Amz-Signature=x');
  });

  it('si el modelo escribe el JSON en texto en lugar de llamar a la herramienta, también se lee', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ content: [{ type: 'text', text: '```json\n{"estancias":5}\n```' }], stop_reason: 'end_turn', usage: {} }));
    expect((await adapter().chat(request())).structured).toEqual({ estancias: 5 });
  });

  it('sin saldo, con 402 o con el error dentro de una respuesta 200, avisa y deja pasar al respaldo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ error: 'x' }, 402)).mockResolvedValueOnce(json({ code: 402, msg: 'insufficient credits' }));
    await expect(adapter().chat(request())).rejects.toMatchObject({ kind: 'provider_down', message: expect.stringContaining('sin saldo') });
    await expect(adapter().chat(request())).rejects.toMatchObject({ kind: 'provider_down', message: expect.stringContaining('sin saldo') });
  });

  it('un JSON cortado por el límite de salida es un error de esquema, que también pasa al respaldo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ content: [{ type: 'text', text: '{"estan' }], stop_reason: 'max_tokens', usage: {} }));
    await expect(adapter().chat(request())).rejects.toMatchObject({ kind: 'schema', message: expect.stringContaining('límite de respuesta') });
  });

  it('un rechazo de KIE por otro motivo explica el motivo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('model not supported', { status: 400 }));
    await expect(adapter().chat(request())).rejects.toMatchObject({ kind: 'provider_down', message: 'KIE rechazó la petición (400): model not supported' });
  });

  it('en streaming devuelve el texto a trozos y el uso al final', async () => {
    const events = [
      { type: 'message_start', message: { usage: { input_tokens: 50 } } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hola ' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Paulo' } },
      { type: 'message_delta', usage: { output_tokens: 4 } },
    ].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(events, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    const deltas = [];
    for await (const delta of adapter().chatStream({ model: 'claude-sonnet-5', messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }] })) deltas.push(delta);
    expect(deltas).toEqual([{ contentDelta: 'Hola ' }, { contentDelta: 'Paulo' }, { usage: { promptTokens: 50, completionTokens: 4 } }]);
  });
});
