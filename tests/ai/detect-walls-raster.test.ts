/**
 * Detección de muros por píxeles, verificada por ida y vuelta: un plano
 * conocido se rasteriza con nuestro propio renderer y la detección debe
 * recuperar sus muros en la posición correcta — sin IA de por medio.
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectWallsFromImage } from '@/server/plan/detect-walls-raster';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { Plano2dPayload } from '@/lib/contracts';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';

/** Sala 10×8 m con un tabique vertical interior en x=6 m (sin aberturas). */
const plan: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'z0',
      name: 'Estancia',
      outline: [],
      walls: [
        { id: 'w0', from: { x: 0, y: 0 }, to: { x: 10000, y: 0 }, thicknessMm: 150 },
        { id: 'w1', from: { x: 10000, y: 0 }, to: { x: 10000, y: 8000 }, thicknessMm: 150 },
        { id: 'w2', from: { x: 10000, y: 8000 }, to: { x: 0, y: 8000 }, thicknessMm: 150 },
        { id: 'w3', from: { x: 0, y: 8000 }, to: { x: 0, y: 0 }, thicknessMm: 150 },
        { id: 'w4', from: { x: 6000, y: 0 }, to: { x: 6000, y: 8000 }, thicknessMm: 150 },
      ],
      apertures: [],
      dimensions: [],
    },
  ],
};

const isVertical = (w: SketchWall) => Math.abs(w.x1 - w.x2) < 0.01;
const isHorizontal = (w: SketchWall) => Math.abs(w.y1 - w.y2) < 0.01;

describe('detectWallsFromImage', () => {
  it('recupera perímetro y tabique de un plano rasterizado por nuestro renderer', async () => {
    const svg = planoToSvg(plan, { pxPerMeter: 70, showDimensions: false, showLabels: false });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    const walls: SketchWall[] = await detectWallsFromImage(png);

    const verticals = walls.filter(isVertical);
    const horizontals = walls.filter(isHorizontal);
    expect(verticals.length).toBeGreaterThanOrEqual(3); // izquierda, tabique, derecha
    expect(horizontals.length).toBeGreaterThanOrEqual(2); // arriba y abajo

    // Los verticales extremos distan casi todo el ancho de la imagen; el
    // tabique queda a ~60% del recorrido entre ambos (x=6 de 10 m).
    const xs = verticals.map((w) => w.x1).sort((a, b) => a - b);
    const span = xs[xs.length - 1]! - xs[0]!;
    expect(span).toBeGreaterThan(0.5);
    const middleRatio = (xs[1]! - xs[0]!) / span;
    expect(middleRatio).toBeGreaterThan(0.55);
    expect(middleRatio).toBeLessThan(0.65);
  });

  it('devuelve poco o nada ante una imagen sin plano (foto uniforme)', async () => {
    const flat = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 190, b: 180 } },
    })
      .png()
      .toBuffer();
    const walls = await detectWallsFromImage(flat);
    expect(walls.length).toBeLessThan(4);
  });
});
