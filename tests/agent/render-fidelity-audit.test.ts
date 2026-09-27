import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-audit';

const image = { base64: 'aGVsbG8=', mimeType: 'image/png' };
const view = { preset: 'front' } as RenderView;
const adapter = (structured: unknown) => {
  const chat = vi.fn(async (request: ChatRequest) => {
    void request;
    return { structured, content: '', usage: { inputTokens: 0, outputTokens: 0 } };
  });
  return { chat, chatStream: vi.fn() } as unknown as ChatVisionAdapter & { chat: typeof chat };
};

describe('auditoría de fidelidad del diseño', () => {
  it('acepta un resultado fiel y adjunta la máscara después de las dos imágenes', async () => {
    const vision = adapter({ accepted: true, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, image)).resolves.toBeUndefined();
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('front') });
  });

  it('rechaza una arquitectura duplicada y no la publica', async () => {
    const vision = adapter({ accepted: false, violations: ['otra casa superpuesta'] });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('otra casa superpuesta');
  });

  it('falla cerrado si la respuesta no se puede validar', async () => {
    const vision = adapter({ accepted: true });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('no respeta la vista 3D');
  });
});
