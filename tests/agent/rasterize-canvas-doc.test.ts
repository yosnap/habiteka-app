import { describe, it, expect } from 'vitest';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { emptyCanvasDoc, type StructObj } from '@/canvas/types';

const obj = (kind: StructObj['kind'], x: number, y: number): StructObj => ({
  id: `${kind}-${x}`,
  kind,
  x,
  y,
  width: 100,
  height: 60,
  rotation: 0,
});

describe('rasterizeCanvasDoc', () => {
  it('devuelve un PNG en base64 (cabecera PNG válida) y la proporción de la sala', async () => {
    // Muros que definen una sala apaisada (ancha): 400×200 ⇒ ~2:1 → 16:9.
    const wall = (x: number, y: number, w: number, h: number) => ({
      ...obj('wall', x, y),
      width: w,
      height: h,
    });
    const doc = {
      ...emptyCanvasDoc(),
      objects: [wall(0, 0, 400, 10), wall(0, 200, 400, 10), obj('sofa', 50, 80)],
    };
    const { base64, aspectRatio } = await rasterizeCanvasDoc(doc);
    const bytes = Buffer.from(base64, 'base64');
    // Firma PNG: 0x89 'P' 'N' 'G'.
    expect(bytes[0]).toBe(0x89);
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    // Sala más ancha que profunda ⇒ proporción horizontal.
    expect(['16:9', '3:2', '4:3']).toContain(aspectRatio);
  });

  it('un lienzo sin objetos también rasteriza (fondo en blanco)', async () => {
    const { base64 } = await rasterizeCanvasDoc(emptyCanvasDoc());
    expect(Buffer.from(base64, 'base64').subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
