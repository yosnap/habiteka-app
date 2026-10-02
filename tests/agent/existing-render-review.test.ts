import { describe, expect, it, vi } from 'vitest';
import { generateOrReviewRender } from '@/server/agent/editor-v2/existing-render-review';
import { conceptRenderSettingsSchema } from '@/server/agent/editor-v2/concept-render-settings';

describe('revisión de una imagen existente', () => {
  it('evita llamar al generador y registra el origen importado sin coste de imagen', async () => {
    const generate = vi.fn();
    const result = await generateOrReviewRender('data:image/png;base64,AAAA', generate);
    expect(generate).not.toHaveBeenCalled();
    expect(result.generation?.provider).toBe('import');
    expect(result.cost.amountUsd).toBe(0);
  });
  it('mantiene la generación normal cuando no se ha elegido un archivo', async () => {
    const result = { assetUrl: 'https://example.test/render.png', cost: { amountUsd: 0.08, unit: 'image' } };
    const generate = vi.fn(async () => result);
    expect(await generateOrReviewRender(undefined, generate)).toBe(result);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each(['https://example.test/render.png', 'data:text/html;base64,AAAA', 'data:image/png;base64,'])('rechaza un origen ajeno al archivo PNG sin llamar al proveedor: %s', async input => {
    const generate = vi.fn();
    await expect(generateOrReviewRender(input, generate)).rejects.toThrow('PNG');
    expect(generate).not.toHaveBeenCalled();
    expect(conceptRenderSettingsSchema.safeParse({ existingImageDataUrl: input }).success).toBe(false);
  });
  it('rechaza un archivo por encima del límite antes del proveedor', async () => {
    const generate = vi.fn();
    await expect(generateOrReviewRender('data:image/png;base64,' + 'A'.repeat(14_000_000), generate)).rejects.toThrow('tamaño');
    expect(generate).not.toHaveBeenCalled();
  });
});
