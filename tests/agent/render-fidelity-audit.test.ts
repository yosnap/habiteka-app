import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-audit';
import sharp from 'sharp';

const image = { base64: (await sharp({ create: { width: 12, height: 8, channels: 3,
  background: '#888' } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
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
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true,
      objectIdentityPreserved: true, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, image, 3)).resolves.toBeUndefined();
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('front') });
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('3 coches') });
    expect(content[1]).toMatchObject({ type: 'image_url', mimeType: 'image/jpeg' });
  });

  it('rechaza una arquitectura duplicada y no la publica', async () => {
    const vision = adapter({ accepted: false, cameraAndGeometryPreserved: false,
      objectIdentityPreserved: true, violations: ['otra casa superpuesta'] });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('otra casa superpuesta');
  });

  it('rechaza la sustitución de coches por sofás aunque el modelo marque accepted', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true,
      objectIdentityPreserved: false, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 3))
      .rejects.toThrow('objetos reconocibles sustituidos');
  });

  it('falla cerrado si la respuesta no se puede validar', async () => {
    const vision = adapter({ accepted: true });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('no respeta la vista 3D');
  });
});
