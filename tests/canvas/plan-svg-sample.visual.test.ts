/**
 * Generador de muestra visual (temporal, no aserciones de negocio): escribe un
 * PNG del plano de ejemplo en el scratchpad para inspección manual del acabado.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { Plano2dPayload } from '@/lib/contracts';

const OUT = process.env.PLAN_SVG_SAMPLE_OUT;

const sample: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'z0',
      name: 'Salón',
      outline: [
        { x: 0, y: 0 },
        { x: 4500, y: 0 },
        { x: 4500, y: 3600 },
        { x: 0, y: 3600 },
      ],
      walls: [
        { id: 'w0', from: { x: 0, y: 0 }, to: { x: 4500, y: 0 }, thicknessMm: 120 },
        { id: 'w1', from: { x: 4500, y: 0 }, to: { x: 4500, y: 3600 }, thicknessMm: 120 },
        { id: 'w2', from: { x: 4500, y: 3600 }, to: { x: 0, y: 3600 }, thicknessMm: 120 },
        { id: 'w3', from: { x: 0, y: 3600 }, to: { x: 0, y: 0 }, thicknessMm: 120 },
      ],
      apertures: [
        { id: 'a0', kind: 'ventana', wallId: 'w0', position: 0.5, widthMm: 1600 },
        { id: 'a1', kind: 'puerta', wallId: 'w2', position: 0.75, widthMm: 900 },
      ],
      dimensions: [
        { id: 'd0', from: { x: 0, y: 0 }, to: { x: 4500, y: 0 }, label: '4.50 m' },
        { id: 'd1', from: { x: 0, y: 3600 }, to: { x: 0, y: 0 }, label: '3.60 m' },
      ],
    },
    {
      id: 'z1',
      name: 'Dormitorio',
      outline: [
        { x: 4500, y: 0 },
        { x: 7500, y: 0 },
        { x: 7500, y: 3600 },
        { x: 4500, y: 3600 },
      ],
      walls: [
        { id: 'w4', from: { x: 4500, y: 0 }, to: { x: 7500, y: 0 }, thicknessMm: 120 },
        { id: 'w5', from: { x: 7500, y: 0 }, to: { x: 7500, y: 3600 }, thicknessMm: 120 },
        { id: 'w6', from: { x: 7500, y: 3600 }, to: { x: 4500, y: 3600 }, thicknessMm: 120 },
      ],
      apertures: [
        { id: 'a2', kind: 'hueco', wallId: 'w1', position: 0.5, widthMm: 900 },
        { id: 'a3', kind: 'ventana', wallId: 'w5', position: 0.5, widthMm: 1400 },
      ],
      dimensions: [{ id: 'd2', from: { x: 4500, y: 0 }, to: { x: 7500, y: 0 }, label: '3.00 m' }],
    },
  ],
};

describe.skipIf(!OUT)('muestra visual del plano SVG', () => {
  it('rasteriza el plano de ejemplo al scratchpad', async () => {
    const svg = planoToSvg(sample, { pxPerMeter: 120 });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(OUT!, png);
    expect(png.length).toBeGreaterThan(0);
  });

  it('rasteriza una extracción SUCIA normalizada (caso boceto real)', async () => {
    const { normalizeSketch } = await import('@/server/ai/sketch/normalize-geometry');
    // Simula los defectos vistos con bocetos reales: caras dobles, tramos
    // troceados, aberturas duplicadas, escala infraestimada y varias estancias.
    const messy = normalizeSketch({
      anchoMetros: 4, // infraestimada: el saneo debe reescalar
      altoMetros: 4,
      muros: [
        // Perímetro con caras dobles arriba y tramos troceados abajo.
        { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 },
        { x1: 0.1, y1: 0.115, x2: 0.9, y2: 0.115 },
        { x1: 0.1, y1: 0.9, x2: 0.5, y2: 0.9 },
        { x1: 0.5, y1: 0.9, x2: 0.9, y2: 0.9 },
        { x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.9 },
        { x1: 0.9, y1: 0.1, x2: 0.9, y2: 0.9 },
        // Tabiques interiores, uno troceado.
        { x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 },
        { x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.5 },
        { x1: 0.3, y1: 0.5, x2: 0.5, y2: 0.5 },
        // Fragmento de ruido.
        { x1: 0.62, y1: 0.48, x2: 0.7, y2: 0.485 },
      ],
      aberturas: [
        { tipo: 'puerta', muro: 6, posicion: 0.7, anchoSobreMuro: 0.2 },
        { tipo: 'puerta', muro: 6, posicion: 0.72 }, // duplicada
        { tipo: 'ventana', muro: 0, posicion: 0.3, anchoSobreMuro: 0.15 },
        { tipo: 'ventana', muro: 1, posicion: 0.31 }, // duplicada en la otra cara
        { tipo: 'ventana', muro: 5, posicion: 0.5, anchoSobreMuro: 0.2 },
        { tipo: 'hueco', muro: 7, posicion: 0.9 },
      ],
      habitaciones: [
        {
          nombre: 'Dormitorio',
          poligono: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.1 },
            { x: 0.5, y: 0.5 },
            { x: 0.1, y: 0.5 },
          ],
        },
        {
          nombre: 'Salón',
          poligono: [
            { x: 0.5, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.5, y: 0.9 },
          ],
        },
        {
          nombre: 'Baño',
          poligono: [
            { x: 0.1, y: 0.5 },
            { x: 0.5, y: 0.5 },
            { x: 0.5, y: 0.9 },
            { x: 0.1, y: 0.9 },
          ],
        },
      ],
    });
    const svg = planoToSvg(messy, { pxPerMeter: 120 });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(OUT!.replace('.png', '-messy.png'), png);
    expect(png.length).toBeGreaterThan(0);
  });
});
