import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
const mock = vi.hoisted(() => ({ prepare: vi.fn(), finish: vi.fn(), fetch: vi.fn() }));
vi.mock('@/server/walkthrough/actions', () => ({
  prepareWalkthroughUpload: mock.prepare, finishWalkthroughUpload: mock.finish,
}));
import { createWalkthroughVideoSaver } from '@/components/editor-v2/session/save-walkthrough-video';
const scope = { projectId: 'project', zoneId: 'zone' };

beforeEach(() => {
  vi.resetAllMocks();
  mock.prepare.mockResolvedValue({ url: 'https://storage.example/upload', ticket: 'signed-ticket' });
  mock.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', mock.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it('registra sonido, cotas, ámbito y duración seleccionados en la visita aprobada o el estudio', async () => {
  const blob = new Blob(['video'], { type: 'video/mp4' });
  const presentation = { ...DEFAULT_VIDEO_PRESENTATION, soundEffects: false, soundVolume: 0,
    contentScope: 'house' as const, dimensionMode: 'start' as const, constructionDurationSeconds: 12 as const };
  await createWalkthroughVideoSaver(scope, 'approval')(blob, 'route', 'construction', presentation);
  expect(mock.prepare).toHaveBeenCalledWith(scope, 'approval', 'route', blob.size, 'construction', 'house', presentation);
  expect(mock.fetch).toHaveBeenCalledWith('https://storage.example/upload', {
    method: 'PUT', body: blob, headers: { 'Content-Type': 'video/mp4' },
  });
  expect(mock.finish).toHaveBeenCalledWith('signed-ticket');
});

it('no registra el vídeo si falla la subida y conserva el error visible', async () => {
  mock.fetch.mockResolvedValue({ ok: false });
  await expect(createWalkthroughVideoSaver(scope, 'approval')(new Blob(['video']), 'route', 'walkthrough'))
    .rejects.toThrow('no se pudo subir');
  expect(mock.finish).not.toHaveBeenCalled();
});
