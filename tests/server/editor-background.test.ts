/**
 * El fondo del editor se alinea sin IA: los muros de la imagen casan con los del plano aunque el dibujo tenga un título
 * subrayado o la flecha del norte, que no forman parte de la casa.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fitBackgroundFrame } from '@/server/plan/editor-background';
import type { EditorDocument } from '@/lib/editor-document/schema';

const house = (): EditorDocument => {
  const points = [[0, 0], [10000, 0], [10000, 6000], [0, 6000], [4000, 0], [4000, 6000]];
  const vertices = points.map(([x, y], index) => ({ id: `v${index}`, x, y }));
  const walls = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5]].map(([a, b], index) => ({ id: `w${index}`, startVertexId: `v${a}`, endVertexId: `v${b}` }));
  return { vertices, walls } as unknown as EditorDocument;
};

describe('fondo del editor alineado con el plano', () => {
  it('casa los muros de la casa e ignora el título subrayado y la flecha del norte', async () => {
    // Casa dibujada de (200,150) a (1000,630) en una imagen de 1200×900, con un tabique en x = 520.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="white"/>
      <path d="M200 150H1000V630H200Z M520 150V630" fill="none" stroke="black" stroke-width="12"/>
      <path d="M40 80H420" stroke="black" stroke-width="6"/><path d="M1120 40V140" stroke="black" stroke-width="6"/>
      <path d="M60 820H520" stroke="black" stroke-width="6"/></svg>`;
    const frame = await fitBackgroundFrame(await sharp(Buffer.from(svg)).png().toBuffer(), house());
    // La imagen entera mide 1200/800 del ancho de la casa y empieza 200 px antes de ella.
    expect(frame.width).toBeGreaterThan(15000 * 0.97);
    expect(frame.width).toBeLessThan(15000 * 1.03);
    expect(frame.height).toBeGreaterThan(11250 * 0.97);
    expect(frame.height).toBeLessThan(11250 * 1.03);
    expect(Math.abs(frame.x - -2500)).toBeLessThan(250);
    expect(Math.abs(frame.y - -1875)).toBeLessThan(250);
  });

  it('una imagen sin muros no se usa como fondo', async () => {
    const blank = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await expect(fitBackgroundFrame(blank, house())).rejects.toThrow(/muros suficientes/);
  });
});
