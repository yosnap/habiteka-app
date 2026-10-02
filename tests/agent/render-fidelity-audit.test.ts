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
  it('distingue elementos ocultos por cámara de pérdidas de identidad', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, { ...view, cutaway: true, ceilingView: 'hidden',
      cutawayObjectIds: ['cortina-frontal'] });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('No los reconstruyas') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('CORTE DE FACHADA') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('cortina-frontal') });
  });
  it('solo relaja fijos cuando existe permiso explícito, manteniendo geometría protegida', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, true);
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('REDISEÑO DE FIJOS') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('muros, huecos, instalaciones, usos y accesos siguen protegidos') });
    expect(content[0]).not.toMatchObject({ text: expect.stringContaining('FIJOS PROTEGIDOS') });
  });
  it('rechaza una copia del mobiliario cuando se pidió un rediseño, aunque la cámara sea fiel', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: false, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, false, true))
      .rejects.toThrow('no se aplicó el rediseño solicitado');
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ text: expect.stringContaining('REDISEÑO REAL') });
  });
  it('falla cerrado si no se pudo evaluar el rediseño solicitado', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, false, undefined, true))
      .rejects.toThrow('no se aplicó el rediseño solicitado');
  });
  it('acepta un resultado fiel y adjunta la máscara después de las dos imágenes', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true,
      objectIdentityPreserved: true, violations: [] });
    await expect(assertRenderFidelity(vision, image, image, view, image, 3)).resolves.toBeUndefined();
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('front') });
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('3 coches') });
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('rechaza huecos nuevos entre tramos') });
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

  it('exige auditar el paisaje inventado cuando el exterior es estricto', async () => {
    const vision = adapter({ accepted: false, cameraAndGeometryPreserved: false,
      objectIdentityPreserved: true, violations: ['terreno y árboles inexistentes'] });
    await expect(assertRenderFidelity(vision, image, image, view, undefined, 0, true))
      .rejects.toThrow('terreno y árboles inexistentes');
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('El usuario pidió fidelidad estricta') });
  });

  it('falla cerrado si la respuesta no se puede validar', async () => {
    const vision = adapter({ accepted: true });
    await expect(assertRenderFidelity(vision, image, image, view)).rejects.toThrow('No se pudo verificar la fidelidad');
  });
  it('audita el volumen e identidad contra la vista cercana y el entorno contra la ortofoto', async () => {
    const vision = adapter({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, violations: [] });
    await assertRenderFidelity(vision, image, image, view, undefined, 0, false, { identity: image, environment: image });
    const content = vision.chat.mock.calls[0]![0].messages[0]!.content;
    expect(content.filter((part) => part.type === 'image_url')).toHaveLength(4);
    expect(content[0]).toMatchObject({ text: expect.stringContaining('pérgolas') });
    expect(content[0]).toMatchObject({ text: expect.stringContaining('ortofoto real') });
  });
});
