import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { KieVideoProvider, KieSubmissionUnknownError, KieSubmissionRejectedError } from '@/server/ai/video/kie-video';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
afterEach(() => vi.unstubAllGlobals());
const settings = { presentation: DEFAULT_VIDEO_PRESENTATION, resolution: '768P' as const };
describe('H3 mediante KIE', () => {
  it('envía Hailuo Standard con inicio y final, duración de texto y sin optimizador que reescriba el guion', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ code: 200, data: { taskId: 'compact' } })); vi.stubGlobal('fetch', request);
    const provider = new KieVideoProvider('key');
    expect(await provider.createCompactTransition('Walk', 6, 'https://example.com/a.png', 'https://example.com/b.png')).toBe('compact');
    expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ model: 'hailuo/02-image-to-video-standard', input: {
      prompt: 'Walk', duration: '6', resolution: '768P', image_url: 'https://example.com/a.png', end_image_url: 'https://example.com/b.png', prompt_optimizer: false } });
    for (const seconds of [4, 12, 60, NaN]) await expect(provider.createCompactTransition('Walk', seconds, 'https://example.com/a.png', 'https://example.com/b.png')).rejects.toBeInstanceOf(KieSubmissionRejectedError);
    await expect(provider.createCompactTransition('x'.repeat(1501), 6, 'https://example.com/a.png', 'https://example.com/b.png')).rejects.toBeInstanceOf(KieSubmissionRejectedError);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('enlaza el primer y último fotograma por el contrato image-to-video y valida antes de enviar', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ code: 200, data: { taskId: 'transition' } })); vi.stubGlobal('fetch', request);
    const provider = new KieVideoProvider('key');
    expect(await provider.createTransition('Walk through the door', 6, '768P', 'https://example.com/a.png', 'https://example.com/b.png')).toBe('transition');
    expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ model: 'minimax-h3/image-to-video', input: {
      prompt: 'Walk through the door', duration: 6, resolution: '768P', first_frame_url: 'https://example.com/a.png', last_frame_url: 'https://example.com/b.png' } });
    for (const seconds of [0, 3, 16, 4.5, NaN]) await expect(provider.createTransition('Walk', seconds, '768P', 'https://example.com/a.png', 'https://example.com/b.png')).rejects.toBeInstanceOf(KieSubmissionRejectedError);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('envía imágenes y ocho segundos mediante el contrato oficial, sin guía de muebles del editor', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ code: 200, data: { taskId: 'task' } })); vi.stubGlobal('fetch', request);
    expect(await new KieVideoProvider('private-key').create('design prompt', settings, ['https://example.com/design.png'])).toBe('task');
    const body = JSON.parse(request.mock.calls[0]![1].body);
    expect(body).toEqual({ model: 'minimax-h3/reference-to-video', input: { prompt: 'design prompt', reference_image_urls: ['https://example.com/design.png'], duration: 8, aspect_ratio: '16:9', resolution: '768P' } });
    expect(body.input.reference_video_urls).toBeUndefined();
  });
  it('no reintenta crear ante una respuesta de red ambigua y distingue un rechazo confirmado', async () => {
    const request = vi.fn().mockRejectedValue(new Error('network')); vi.stubGlobal('fetch', request);
    await expect(new KieVideoProvider('key').create('prompt', settings, ['https://example.com/a.png'])).rejects.toBeInstanceOf(KieSubmissionUnknownError);
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValue(Response.json({ code: 402 }, { status: 402 }));
    await expect(new KieVideoProvider('key').create('prompt', settings, ['https://example.com/a.png'])).rejects.toBeInstanceOf(KieSubmissionRejectedError);
  });
  it('consulta la tarea guardada sin crear otra y rechaza resultados internos', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ code: 200, data: { taskId: 'task', state: 'generating' } })); vi.stubGlobal('fetch', request);
    expect(await new KieVideoProvider('key').status('task')).toEqual({ state: 'pending' });
    expect(request.mock.calls[0]![0]).toContain('/recordInfo?taskId=task');
    request.mockResolvedValue(Response.json({ code: 200, data: { taskId: 'task', state: 'success', resultJson: JSON.stringify({ resultUrls: ['http://127.0.0.1/video'] }) } }));
    await expect(new KieVideoProvider('key').status('task')).rejects.toThrow('permitida');
  });
  it('conserva el MP4 y rechaza un HTML aunque llegue como resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('0000ftyp00000000000000000000000000'))));
    expect((await new KieVideoProvider('key').download('https://example.com/video.mp4')).subarray(4, 8).toString()).toBe('ftyp');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>failed</html>')));
    await expect(new KieVideoProvider('key').download('https://example.com/video.mp4')).rejects.toThrow('MP4');
  });
});
