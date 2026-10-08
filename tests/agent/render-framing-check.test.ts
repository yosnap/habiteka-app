import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { assertRenderFraming } from '@/server/agent/editor-v2/render-framing-check';
import { reviewRenderFidelity } from '@/server/agent/editor-v2/review-render-fidelity';
import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';

async function image(left: number, top: number, width: number, height: number) {
  const svg = `<svg width="400" height="200"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#384350"/></svg>`;
  const bytes = await sharp({ create: { width: 400, height: 200, channels: 3,
    background: '#f4f4f2' } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  return { base64: bytes.toString('base64'), mimeType: 'image/png' };
}

describe('encuadre del render', () => {
  it('acepta el mismo inmueble y pequeñas variaciones de encuadre', async () => {
    const original = await image(140, 60, 120, 80);
    const edit = await image(136, 58, 126, 82);
    await expect(assertRenderFraming(original, edit)).resolves.toBeUndefined();
  });

  it('acepta un acercamiento que mantiene completa la escena', async () => {
    await expect(assertRenderFraming(await image(140, 60, 120, 80), await image(90, 35, 220, 130)))
      .resolves.toBeUndefined();
  });

  it('rechaza una ampliación extrema dentro de la misma cámara', async () => {
    await expect(assertRenderFraming(await image(140, 60, 120, 80), await image(45, 5, 300, 190)))
      .rejects.toThrow('recortó o desplazó');
  });

  it('rechaza desplazar el inmueble fuera de su posición original', async () => {
    await expect(assertRenderFraming(await image(100, 60, 120, 80), await image(205, 60, 120, 80)))
      .rejects.toThrow('recortó o desplazó');
  });

  it('devuelve un descarte conservable, sin fingir una auditoría visual ni llamar a la IA', async () => {
    const chat = vi.fn(), vision = { chat, chatStream: vi.fn() } as unknown as ChatVisionAdapter;
    const review = await reviewRenderFidelity(vision, await image(140, 60, 120, 80),
      await image(45, 5, 300, 190), { preset: 'right' } as RenderView);
    expect(review.review?.status).toBe('rejected');
    expect(review.fidelity).toMatchObject({ version: 'render-framing-v1', status: 'rejected',
      criteria: [{ id: 'cameraAndGeometryPreserved', status: 'fail', observation: expect.stringContaining('no se ejecutó la auditoría visual') }],
      roomChecks: [], openingChecks: [],
    });
    expect(chat).not.toHaveBeenCalled();
    expect(review.fidelity.model).toBeUndefined();
  });
});
