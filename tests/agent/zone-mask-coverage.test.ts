import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));
const { zoneMaskCoverage } =
  await import('../../src/server/agent/editor-v2/zone-mask-coverage');

const W = 200, H = 100;
const solid = (r: number, g: number, b: number) =>
  sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } }).png().toBuffer();
/** Máscara con la mitad izquierda blanca. */
const halfMask = () => sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .composite([{ input: { create: { width: W / 2, height: H, channels: 3, background: '#fff' } }, left: 0, top: 0 }])
  .png().toBuffer();
describe('máscara de zonas permitidas', () => {
  it('mide qué parte de la imagen ocupa la zona', async () => {
    expect(await zoneMaskCoverage(await halfMask())).toBeCloseTo(0.5, 2);
    expect(await zoneMaskCoverage(await solid(0, 0, 0))).toBe(0);
  });

  it('identifica una máscara vacía antes de pagar una imagen', async () => {
    expect(await zoneMaskCoverage(await solid(0, 0, 0))).toBe(0);
  });
});
