import { describe, expect, it, vi } from 'vitest';
import { prepareRenderCaptures } from '@/components/editor-v2/prepare-render-captures';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { twoRoomDocument } from '../fixtures/two-room-document';

describe('preparación de referencias cercanas antes de vistas lejanas', () => {
  it('prepara la cenital antes del exterior terminado, conserva su nombre y cuenta ambas imágenes', async () => {
    const capture = vi.fn(async (options?: Parameters<CaptureRenderView>[0]) => ({ view: { preset: options?.view,
      cutaway: false, ceilingView: options?.view === 'exterior' ? 'solid' : 'hidden' } } as RenderCapture));
    const result = await prepareRenderCaptures({ options: { ...defaultRenderDesignOptions(), views: ['exterior', 'top'] },
      capture, document: emptyEditorDocument(), snapshot: 'same', currentSnapshot: () => 'same' });
    expect(result.map(item => item.view.preset)).toEqual(['top', 'exterior']);
  });
  it('interrumpe el lote antes de generar si la primera captura borra un tabique', async () => {
    const capture = vi.fn(async () => ({ view: { preset: 'back', cutaway: true, cutawayWallIds: ['w6'] } } as RenderCapture));
    await expect(prepareRenderCaptures({ options: { ...defaultRenderDesignOptions(), views: ['back', 'drone'] },
      capture, document: twoRoomDocument(), snapshot: 'same', currentSnapshot: () => 'same' })).rejects.toThrow('tabiques interiores');
    expect(capture).toHaveBeenCalledTimes(1);
  });
  it('prepara cenital antes de isométrica y dron aunque el usuario las marque en otro orden', async () => {
    const capture = vi.fn(async (options?: Parameters<CaptureRenderView>[0]) => ({ view: { preset: options?.view } } as RenderCapture));
    await prepareRenderCaptures({ options: { ...defaultRenderDesignOptions(), views: ['drone', 'isometric', 'top'] },
      capture, document: emptyEditorDocument(), snapshot: 'same', currentSnapshot: () => 'same' });
    expect(capture.mock.calls.map(([options]) => options?.view)).toEqual(['top', 'isometric', 'drone']);
  });
  it('ordena también la vista actual si corresponde a una cámara lejana', async () => {
    const capture = vi.fn(async (options?: Parameters<CaptureRenderView>[0]) => ({
      view: { preset: options?.view === 'current' ? 'isometric' : options?.view } } as RenderCapture));
    const results = await prepareRenderCaptures({ options: { ...defaultRenderDesignOptions(), views: ['current', 'top'] },
      capture, document: emptyEditorDocument(), snapshot: 'same', currentSnapshot: () => 'same' });
    expect(results.map((item) => item.view.preset)).toEqual(['top', 'isometric']);
  });
  it('invalida todo el lote si el plano cambia durante una captura', async () => {
    let snapshot = 'before';
    const capture = vi.fn(async () => { snapshot = 'after'; return {} as RenderCapture; });
    await expect(prepareRenderCaptures({ options: { ...defaultRenderDesignOptions(), views: ['top', 'drone'] },
      capture, document: emptyEditorDocument(), snapshot, currentSnapshot: () => snapshot }))
      .rejects.toThrow('plano cambió');
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
