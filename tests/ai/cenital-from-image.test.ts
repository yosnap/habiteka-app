/**
 * Cenital directamente desde la imagen del plano redibujado: la imagen viaja
 * como referencia y el prompt exige respetar la disposición leyendo los
 * rótulos del propio plano. Sin red.
 */
import { describe, expect, it } from 'vitest';
import { generateCenitalFromImage } from '@/server/ai/design/cenital-pipeline';
import { buildCenitalImagePrompt } from '@/server/ai/design/room-prompt-builder';
import type { ImageAdapter, ImageGenRequest } from '@/lib/contracts';

describe('buildCenitalImagePrompt', () => {
  it('exige respetar la disposición, leer los rótulos y aplica el estilo', () => {
    const p = buildCenitalImagePrompt('japandi');
    expect(p).toContain('EXACTAMENTE');
    expect(p).toContain('rótulo');
    expect(p).toContain('Japandi');
    expect(p).toContain('No añadas ni muevas');
  });
});

describe('generateCenitalFromImage', () => {
  it('envía la imagen del plano como referencia', async () => {
    let captured: ImageGenRequest | null = null;
    const image: ImageAdapter = {
      generate: async (req) => {
        captured = req;
        return { assetUrl: 'https://assets/cenital.png', cost: { amountUsd: 0.04, unit: 'image' } };
      },
      inpaint: async () => {
        throw new Error('no aplica');
      },
    };

    const result = await generateCenitalFromImage(
      { image },
      { base64: 'PLANBASE64', mimeType: 'image/png' },
      'moderno',
    );

    expect(result.assetUrl).toBe('https://assets/cenital.png');
    expect(captured!.referenceImage).toEqual({ base64: 'PLANBASE64', mimeType: 'image/png' });
    expect(captured!.prompt).toBe(buildCenitalImagePrompt('moderno'));
  });
});
