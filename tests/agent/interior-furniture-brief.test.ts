import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { interiorFurnitureBrief } from '@/server/agent/editor-v2/interior-furniture-brief';
vi.mock('@/server/agent/editor-v2/render-audit-details', () => ({ renderAuditDetails: async () => [] }));
const image = { base64: 'accepted', mimeType: 'image/png' };
const view = { roomName: 'Salón' } as RenderView;
const context = { units: 'mm' as const, levels: [] };
it.each([undefined, { located: false, elements: [{ name: 'mesa', appearance: 'clara' }] },
  { located: true, elements: [] }])('detiene la generación si no hay una lectura situada y completa', async structured => {
  const chat = { chat: vi.fn().mockResolvedValue({ structured }) } as unknown as ChatVisionAdapter;
  await expect(interiorFurnitureBrief(chat, image, view, context)).rejects.toThrow('No se pudo identificar');
});
it('adjunta solo un recorte de píxeles originales cuando localiza la estancia en la cenital completa', async () => {
  const accepted = { mimeType: 'image/png', base64: (await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#9cb' } }).png().toBuffer()).toString('base64') };
  const chat = { chat: vi.fn().mockResolvedValue({ structured: { located: true,
    roomBox: { left: 400, top: 200, right: 600, bottom: 500 }, connections: [], elements: [{ name: 'fuente', appearance: 'cuadrada baja' }] } }) };
  const result = await interiorFurnitureBrief(chat as unknown as ChatVisionAdapter, accepted, view, context);
  expect(result.brief).toEqual(['fuente: cuadrada baja']);
  const metadata = await sharp(Buffer.from(result.detail!.base64, 'base64')).metadata();
  expect([metadata.width, metadata.height]).toEqual([230, 330]);
});
it('lee solo la referencia aceptada antes de generar, sin muebles de la maqueta', async () => {
  const chat = vi.fn().mockResolvedValue({ structured: { located: true, roomBox: null, connections: [], elements: [{ name: 'sillas', appearance: 'respaldo curvo beige' }] } });
  expect(await interiorFurnitureBrief({ chat } as unknown as ChatVisionAdapter, image, view, context)).toEqual({ brief: ['sillas: respaldo curvo beige'] });
  expect(chat.mock.calls[0]![0].messages[0].content.filter((part: { type: string }) => part.type === 'image_url')).toEqual([{ type: 'image_url', ...image }]);
});
it('no genera si la lectura omite el recinto del otro lado de un hueco', async () => {
  const chat = { chat: vi.fn().mockResolvedValue({ structured: { located: true, roomBox: null, connections: [],
    elements: [{ name: 'fuente', appearance: 'cuadrada' }] } }) } as unknown as ChatVisionAdapter;
  await expect(interiorFurnitureBrief(chat, image, view, { units: 'mm', levels: [{ id: 'g', name: 'Planta', rooms: [],
    openings: [{ id: 'door', kind: 'puerta', center: { x: 0, y: 0 }, widthMm: 1000, heightMm: 2000 }] }] }))
    .rejects.toThrow('todas las conexiones');
});
