/**
 * Pipeline cenital (F3): el prompt se construye desde los DATOS del plano, el
 * raster viaja como imagen de referencia y el payload del cliente se acota
 * antes de rasterizar. Sin red: adaptador y rasterizador stub.
 */
import { describe, expect, it } from 'vitest';
import {
  assertPlanoRasterizable,
  generateCenital,
} from '@/server/ai/design/cenital-pipeline';
import { buildCenitalPrompt } from '@/server/ai/design/room-prompt-builder';
import { rasterizePlano } from '@/server/plan/rasterize-plan-svg';
import type { ImageAdapter, ImageGenRequest, Plano2dPayload } from '@/lib/contracts';

function twoRooms(): Plano2dPayload {
  return {
    schemaVersion: 1,
    zones: [
      {
        id: 'z0',
        name: 'Cocina',
        outline: [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 3000 },
          { x: 0, y: 3000 },
        ],
        walls: [{ id: 'w0', from: { x: 0, y: 0 }, to: { x: 3000, y: 0 }, thicknessMm: 120 }],
        apertures: [
          { id: 'a0', kind: 'ventana', wallId: 'w0', position: 0.5, widthMm: 1200 },
          { id: 'a1', kind: 'puerta', wallId: 'w0', position: 0.2, widthMm: 900 },
        ],
        dimensions: [],
      },
      {
        id: 'z1',
        name: 'Salón',
        outline: [
          { x: 3000, y: 0 },
          { x: 7000, y: 0 },
          { x: 7000, y: 3000 },
          { x: 3000, y: 3000 },
        ],
        walls: [{ id: 'w1', from: { x: 3000, y: 0 }, to: { x: 7000, y: 0 }, thicknessMm: 120 }],
        apertures: [],
        dimensions: [],
      },
    ],
  };
}

describe('buildCenitalPrompt', () => {
  it('describe cada estancia con su superficie y aberturas reales', () => {
    const prompt = buildCenitalPrompt(twoRooms(), 'nordico');
    expect(prompt).toContain('Cocina');
    expect(prompt).toContain('9.0 m²');
    expect(prompt).toContain('1 puerta y 1 ventana');
    expect(prompt).toContain('Salón');
    expect(prompt).toContain('12.0 m²');
    expect(prompt).toContain('Nórdico');
  });

  it('exige respetar la disposición de la imagen adjunta y prohíbe inventar', () => {
    const prompt = buildCenitalPrompt(twoRooms(), 'moderno');
    expect(prompt).toContain('EXACTAMENTE');
    expect(prompt).toContain('No añadas ni muevas');
  });
});

describe('assertPlanoRasterizable', () => {
  it('acepta un plano razonable', () => {
    expect(() => assertPlanoRasterizable(twoRooms())).not.toThrow();
  });

  it('rechaza planos vacíos, sin muros o con coordenadas absurdas', () => {
    expect(() => assertPlanoRasterizable({ schemaVersion: 1, zones: [] })).toThrow(/vacío/);

    const sinMuros = twoRooms();
    for (const z of sinMuros.zones) z.walls = [];
    expect(() => assertPlanoRasterizable(sinMuros)).toThrow(/muros/);

    const gigante = twoRooms();
    gigante.zones[0]!.walls[0]!.to.x = 10_000_000; // 10 km: DoS del rasterizador
    expect(() => assertPlanoRasterizable(gigante)).toThrow(/fuera de rango/);
  });
});

describe('generateCenital', () => {
  it('envía el raster como imagen de referencia y el prompt desde datos', async () => {
    let captured: ImageGenRequest | null = null;
    const image: ImageAdapter = {
      generate: async (req) => {
        captured = req;
        return {
          assetUrl: 'https://assets/render.png',
          cost: { amountUsd: 0.04, unit: 'image' as const },
        };
      },
      inpaint: async () => {
        throw new Error('no aplica');
      },
    };
    const rasterize = async () => ({ base64: 'PNGBASE64', aspectRatio: '16:9' });

    const result = await generateCenital({ image, rasterize }, twoRooms(), 'moderno');

    expect(result.assetUrl).toBe('https://assets/render.png');
    expect(captured!.referenceImage).toEqual({ base64: 'PNGBASE64', mimeType: 'image/png' });
    expect(captured!.aspectRatio).toBe('16:9');
    expect(captured!.prompt).toContain('Cocina');
  });
});

describe('rasterizePlano', () => {
  it('produce un PNG base64 con proporción canónica (sin textos)', async () => {
    const { base64, aspectRatio } = await rasterizePlano(twoRooms());
    // Firma PNG en base64 ('iVBORw0KGgo' = \x89PNG...).
    expect(base64.startsWith('iVBOR')).toBe(true);
    expect(['16:9', '3:2', '4:3']).toContain(aspectRatio);
  });
});
