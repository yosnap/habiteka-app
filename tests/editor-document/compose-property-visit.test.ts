import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ add: vi.fn(), dispose: vi.fn(), close: vi.fn(), cancel: vi.fn(), duration: 15 }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], UrlSource: class {}, Mp4OutputFormat: class {}, BufferTarget: class { buffer = new ArrayBuffer(100); },
  Input: class { dispose = m.dispose; async getPrimaryVideoTrack() { return { canDecode: async () => true, computeDuration: async () => m.duration }; } },
  Output: class { state = 'pending'; target = { buffer: new ArrayBuffer(100) }; addVideoTrack() {} async start() {} async finalize() { this.state = 'finalized'; } async cancel() { m.cancel(); this.state = 'canceled'; } },
  CanvasSource: class { add = m.add; close() {} },
  VideoSampleSink: class { async *samples() { for (const timestamp of [1, 6, 11]) yield { timestamp, duration: 5, displayWidth: 1920, displayHeight: 1080, draw() {}, close: m.close }; } },
}));
import { composePropertyVisit } from '@/components/deliverables/compose-property-visit';
beforeEach(() => {
  vi.clearAllMocks(); m.duration = 15;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {} }) }) });
});
describe('composición completa de tramos IA', () => {
  it('conserva orden y duración por encima de 110 segundos y libera todos los fotogramas', async () => {
    const progress = vi.fn(), clips = Array.from({ length: 10 }, (_, i) => ({ url: `clip-${i}`, seconds: 15 }));
    const result = await composePropertyVisit(clips, new AbortController().signal, progress);
    expect(result.durationMs).toBe(150000); expect(result.blob.type).toBe('video/mp4');
    expect(m.add.mock.calls.map(call => call[0])).toEqual(Array.from({ length: 30 }, (_, i) => i * 5));
    expect(m.close).toHaveBeenCalledTimes(30); expect(m.dispose).toHaveBeenCalledTimes(10); expect(progress).toHaveBeenLastCalledWith(1);
    expect(m.cancel).not.toHaveBeenCalled();
  });
  it('rechaza un clip corto y cancela la salida sin fingir un paseo completo', async () => {
    m.duration = 8;
    await expect(composePropertyVisit([{ url: 'clip', seconds: 15 }], new AbortController().signal, vi.fn())).rejects.toThrow('duración');
    expect(m.dispose).toHaveBeenCalledOnce(); expect(m.cancel).toHaveBeenCalledOnce(); expect(m.add).not.toHaveBeenCalled();
  });
  it('atiende la cancelación antes de decodificar', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(composePropertyVisit([{ url: 'clip', seconds: 15 }], controller.signal, vi.fn())).rejects.toThrow();
    expect(m.add).not.toHaveBeenCalled(); expect(m.cancel).toHaveBeenCalledOnce();
  });
});
