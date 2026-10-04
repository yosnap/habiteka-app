import { afterEach, describe, expect, it, vi } from 'vitest';
import { KieImageProvider } from '@/server/ai/image/providers/kie-image';
import { canFailover } from '@/server/ai/errors';

afterEach(() => vi.restoreAllMocks());

describe('KieImageProvider', () => {
  it('envía la imagen completa y su máscara como dos referencias del mismo retoque', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { downloadUrl: 'https://files.kie.ai/mask.png' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: 200, data: { taskId: 'masked' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: 200, data: { state: 'success',
        resultJson: JSON.stringify({ resultUrls: ['https://kie.test/edited.png'] }) } }) });
    vi.stubGlobal('fetch', fetcher);
    await new KieImageProvider('test', undefined, 'gpt-image-2-5-sunburst-image-to-image', { pollIntervalMs: 0 }).inpaint({
      prompt: 'Corrige solo la zona blanca', baseImage: { url: 'https://files.kie.ai/base.png' },
      editMask: { base64: 'bWFzaw==', mimeType: 'image/png' }, zone: { id: 'z', bbox: { x: .2, y: .2, width: .1, height: .1 } },
    });
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).input.input_urls).toEqual(['https://files.kie.ai/base.png', 'https://files.kie.ai/mask.png']);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('createTask'))).toHaveLength(1);
  });
  it('retoca una imagen local subiéndola a KIE, sin exigir storage público ni generar otra tarea', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { downloadUrl: 'https://files.kie.ai/base.png' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'edit' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: {
        state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://kie.test/edited.png'] }),
      } }) });
    vi.stubGlobal('fetch', fetcher);
    const result = await new KieImageProvider('test', undefined, 'gpt-image-2-5-sunburst-image-to-image', { pollIntervalMs: 0 })
      .inpaint({ prompt: 'Quita solo la hoja inventada', baseImage: { base64: 'cGxhbg==', mimeType: 'image/png' },
        zone: { id: 'all', bbox: { x: 0, y: 0, width: 1, height: 1 } } });
    expect(result.assetUrl).toBe('https://kie.test/edited.png');
    expect(fetcher.mock.calls[0]![0]).toContain('file-base64-upload');
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toMatchObject({
      input: { input_urls: ['https://files.kie.ai/base.png'], resolution: '4K' },
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('Gemini Pro de KIE usa contexto compacto al superar 10000 caracteres', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'gemini' } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data: {
        state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://kie.test/gemini.png'] }),
      } }) });
    vi.stubGlobal('fetch', fetcher);
    await new KieImageProvider('test', undefined, 'nano-banana-pro', { pollIntervalMs: 0 }).generate({
      prompt: 'x'.repeat(10001), compactPrompt: 'Conserva la geometría del patio.',
      referenceImage: { url: 'https://kie.test/reference.png' },
    });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ model: 'nano-banana-pro',
      input: { prompt: 'Conserva la geometría del patio.', image_input: ['https://kie.test/reference.png'] } });
  });
  it('Gemini Pro rechaza contexto que excede su límite antes de enviar', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(new KieImageProvider('test', undefined, 'nano-banana-pro').generate({
      prompt: 'x'.repeat(10001), compactPrompt: 'y'.repeat(10001),
    })).rejects.toMatchObject({ code: 'kie_prompt_too_long' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('conserva el identificador pendiente y evita otra generación al vencer la espera', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ code: 200, data: { taskId: 'accepted-task' } }) });
    vi.stubGlobal('fetch', fetcher);
    const error = await new KieImageProvider('test', undefined, 'flux-2/flex-image-to-image', { timeoutMs: 0 })
      .generate({ prompt: 'patio', referenceImage: { url: 'https://kie.test/reference.png' } }).catch(error => error);
    expect(error).toMatchObject({ code: 'kie_task_pending', providerTaskId: 'accepted-task', kind: 'timeout' });
    expect(canFailover(error)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('permite respaldo cuando KIE confirma que la tarea ha fallado', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'failed-task' } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data: { state: 'fail' } }) }));
    const error = await new KieImageProvider('test', undefined, 'flux-2/flex-image-to-image', { pollIntervalMs: 0 })
      .generate({ prompt: 'patio', referenceImage: { url: 'https://kie.test/reference.png' } }).catch(error => error);
    expect(error).toMatchObject({ code: 'kie_task_failed' });
    expect(canFailover(error)).toBe(true);
  });
  it('FLUX usa el prompt compacto cuando el completo supera 5000 caracteres', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'compact' } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data: {
        state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://kie.test/compact.png'] }),
      } }) });
    vi.stubGlobal('fetch', fetcher);
    await new KieImageProvider('test', undefined, 'flux-2/flex-image-to-image', { pollIntervalMs: 0 }).generate({
      prompt: 'x'.repeat(5001), compactPrompt: 'Conservar cotas y geometría del proyecto.',
      referenceImage: { url: 'https://kie.test/reference.png' },
    });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).input.prompt).toBe('Conservar cotas y geometría del proyecto.');
  });
  it('rechaza FLUX sobredimensionado antes de subir imágenes, sin truncar restricciones', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(new KieImageProvider('test', undefined, 'flux-2/pro-image-to-image').generate({
      prompt: 'x'.repeat(5001), compactPrompt: 'y'.repeat(5001), referenceImage: { base64: 'abc' },
    })).rejects.toMatchObject({ code: 'kie_prompt_too_long' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('lee state y resultJson del contrato Market real', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'market' } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data: {
        state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://kie.test/market.png'] }),
      } }) }));
    const provider = new KieImageProvider('test', undefined, 'gpt-image-2-5-sunburst-image-to-image', { pollIntervalMs: 0, timeoutMs: 30 });
    await expect(provider.generate({ prompt: 'patio' })).resolves.toMatchObject({ assetUrl: 'https://kie.test/market.png' });
  });
  it.each([
    { state: 'fail', failMsg: 'generación fallida' },
    { state: 'success', resultJson: 'invalid' },
    { state: 'success', resultJson: '{"resultUrls":[]}' },
  ])('rechaza un resultado Market fallido o incompleto: %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'market' } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data }) }));
    const provider = new KieImageProvider('test', undefined, 'nano-banana-2-lite', { pollIntervalMs: 0, timeoutMs: 30 });
    await expect(provider.generate({ prompt: 'patio' })).rejects.toThrow(/KIE/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('crea una tarea, espera su resultado y conserva el proveedor de imagen', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, data: { taskId: 'task-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            data: { successFlag: 1, response: { result_urls: ['https://kie.test/image.png'] } },
          }),
        }),
    );
    const provider = new KieImageProvider('test-key', undefined, 'nano-banana-2-lite', {
      pollIntervalMs: 0,
    });

    const result = await provider.generate({ prompt: 'salón', aspectRatio: '16:9' });

    expect(result.assetUrl).toBe('https://kie.test/image.png');
    expect(result.cost).toEqual({ amountUsd: 0.03, unit: 'image' });
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      model: 'nano-banana-2-lite',
      input: { prompt: 'salón', aspect_ratio: '16:9' },
    });
  });

  it('registra el coste con los créditos que KIE descuenta en la tarea', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'task-2' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { state: 'success',
        resultJson: JSON.stringify({ resultUrls: ['https://kie.test/4k.png'] }), creditsConsumed: 16 } }) }));
    const provider = new KieImageProvider('test-key', undefined, 'gpt-image-2-5-sunburst-image-to-image', { pollIntervalMs: 0 });
    const result = await provider.generate({ prompt: 'alzado', aspectRatio: '16:9' });
    expect(result.cost).toEqual({ amountUsd: 0.08, unit: 'image', confirmedUsd: 0.08 });
  });

  it('rechaza modelos KIE que no usan la API unificada implementada', () => {
    expect(() => new KieImageProvider('test-key', undefined, 'flux-kontext-max')).toThrow(
      /aún no está conectado/,
    );
  });

  it('sube el plano base64 a KIE antes de crear la tarea de referencia', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { downloadUrl: 'https://files.kie.ai/plan.png' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, data: { taskId: 'task-2' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            data: { successFlag: 1, response: { result_urls: ['https://kie.test/image.png'] } },
          }),
        }),
    );
    const provider = new KieImageProvider('test-key', undefined, 'nano-banana-2-lite', {
      pollIntervalMs: 0,
    });

    await provider.generate({
      prompt: 'patio',
      referenceImage: { base64: 'cGxhbg==', mimeType: 'image/png' },
    });

    const upload = vi.mocked(fetch).mock.calls[0];
    expect(upload?.[0]).toBe('https://kieai.redpandaai.co/api/file-base64-upload');
    expect(JSON.parse(String(upload?.[1]?.body))).toMatchObject({
      base64Data: 'data:image/png;base64,cGxhbg==',
    });
    const task = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body));
    expect(task.input.image_input).toEqual(['https://files.kie.ai/plan.png']);
  });

  it('envía las referencias de FLUX.2 mediante input_urls', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, data: { taskId: 'task-flux' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            data: { successFlag: 1, response: { result_urls: ['https://kie.test/flux.png'] } },
          }),
        }),
    );
    const provider = new KieImageProvider('test-key', undefined, 'flux-2/flex-image-to-image', {
      pollIntervalMs: 0,
    });

    await provider.generate({
      prompt: 'patio elevado',
      referenceImages: [
        { url: 'https://files.kie.ai/plan.png' },
        { url: 'https://files.kie.ai/structure.png' },
      ],
    });

    const task = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(task).toMatchObject({
      model: 'flux-2/flex-image-to-image',
      input: {
        input_urls: ['https://files.kie.ai/plan.png', 'https://files.kie.ai/structure.png'],
        aspect_ratio: 'auto',
        resolution: '1K',
        nsfw_checker: false,
      },
    });
    expect(task.input).not.toHaveProperty('image_input');
  });

  it('usa salida 4K con referencias para GPT Image 2.5 Sunburst', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, data: { taskId: 'task-sunburst' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            data: { successFlag: 1, response: { result_urls: ['https://kie.test/sunburst.png'] } },
          }),
        }),
    );
    const provider = new KieImageProvider(
      'test-key',
      undefined,
      'gpt-image-2-5-sunburst-image-to-image',
      { pollIntervalMs: 0 },
    );

    await provider.generate({
      prompt: 'patio elevado',
      referenceImage: { url: 'https://files.kie.ai/plan.png' },
    });

    const task = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(task).toMatchObject({
      model: 'gpt-image-2-5-sunburst-image-to-image',
      input: {
        input_urls: ['https://files.kie.ai/plan.png'],
        aspect_ratio: 'auto',
        resolution: '4K',
      },
    });
  });

  it('preserva el contexto JSON largo para Sunburst', async () => {
    const prompt = [
      'Render arquitectónico fotorrealista del EXTERIOR, estilo contemporáneo.',
      'Es un PATIO EXTERIOR abierto. No lo trates como salón.',
      'La imagen adjunta y el contexto estructurado son una restricción dura.',
      JSON.stringify({ walls: Array.from({ length: 500 }, () => ({ x: 123, y: 456 })) }),
      'Además, el usuario pide: "vegetación mediterránea sin mobiliario".',
    ].join('\n\n');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'task-long' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { successFlag: 1, response: { result_urls: ['https://kie.test/long.png'] } } }) }));
    const provider = new KieImageProvider('test-key', undefined, 'gpt-image-2-5-sunburst-image-to-image', { pollIntervalMs: 0 });
    await provider.generate({ prompt });
    const task = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(task.input.prompt).toBe(prompt);
  });
  it('reintenta la descarga del resultado y lo guarda en el almacenamiento si el primer intento vence', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { taskId: 'slow-cdn' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: {
        state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://kie.test/slow.png'] }),
      } }) })
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer });
    vi.stubGlobal('fetch', fetcher);
    const put = vi.fn(async () => {});
    const storage = { put, getPresignedDownloadUrl: async (key: string) => `https://storage.test/${key}` } as never;
    const result = await new KieImageProvider('test', storage, 'flux-2/flex-image-to-image', { pollIntervalMs: 0, resultDownloadTimeoutMs: 50 })
      .generate({ prompt: 'patio', referenceImage: { url: 'https://kie.test/reference.png' } });
    expect(put).toHaveBeenCalledTimes(1);
    expect(result.assetKey).toMatch(/^renders\/kie\/.*\.png$/);
    expect(result.assetUrl).toContain('https://storage.test/renders/kie/');
    expect(fetcher.mock.calls.filter((call) => call[0] === 'https://kie.test/slow.png')).toHaveLength(2);
  });
});
