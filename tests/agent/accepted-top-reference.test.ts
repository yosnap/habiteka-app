import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { acceptedTopForView } from '@/server/agent/editor-v2/accepted-top-reference';
import type { RenderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import type { CameraRoomGuide } from '@/server/agent/editor-v2/render-camera-room-guide';

const image = async (width: number, height: number, draw: (x: number, y: number) => [number, number, number]) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set(draw(x, y), (y * width + x) * 3);
  return { base64: (await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' };
};
const raw = async (base64: string) => sharp(Buffer.from(base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });

// Planta de 10 × 4 m dibujada en x 20–220 y 20–100 de una cenital de 240 × 120 sobre fondo claro.
const document = emptyEditorDocument();
document.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10000, y: 0 }, { id: 'c', x: 10000, y: 4000 }, { id: 'd', x: 0, y: 4000 }];
document.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']].map(([start, end], index) => ({ id: `w${index}`,
  startVertexId: start!, endVertexId: end!, thicknessMm: 200, dimensionalOrigin: 'physical' as const }));
const room = (id: string, left: number, right: number, y: number) => ({ id, name: id, anchor: { x: (left + right) / 2, y },
  boundary: [{ x: left, y: 0 }, { x: right, y: 0 }, { x: right, y: 4000 }, { x: left, y: 4000 }] });
const spatial: RenderSpatialContext = { units: 'mm', levels: [{ id: 'l', name: 'Planta', openings: [],
  rooms: [room('oeste', 0, 5000, 1000), room('este', 5000, 10000, 3000)] }] };
const top = () => image(240, 120, (x, y) => x < 20 || x >= 220 || y < 20 || y >= 100 ? [240, 236, 228]
  : x < 120 ? [200, 30, 30] : [30, 30, 200]);

describe('cenital aceptada adaptada a cada alzado', () => {
  it('gira la cenital para que su borde inferior sea la fachada cortada', async () => {
    const plan = await image(4, 2, (x, y) => x === 0 && y === 0 ? [255, 0, 0] : [255, 255, 255]);
    const corner = { front: [0, 0], back: [3, 1], left: [0, 3], right: [1, 0] } as const;
    for (const [preset, [x, y]] of Object.entries(corner)) {
      const { data, info } = await raw((await acceptedTopForView(plan, preset, emptyEditorDocument(), spatial)).base64);
      expect([info.width, info.height]).toEqual(preset === 'left' || preset === 'right' ? [2, 4] : [4, 2]);
      const at = (y * info.width + x) * info.channels;
      expect([data[at], data[at + 1], data[at + 2]]).toEqual([255, 0, 0]);
    }
  });
  it('recorta las estancias que la cámara no ve de frente', async () => {
    const guide: CameraRoomGuide = { rooms: [{ id: 'este', name: 'este', x: .5, y: .5 },
      { id: 'oeste', name: 'oeste', x: .2, y: .5, visibility: 'through-opening' }] };
    const { data, info } = await raw((await acceptedTopForView(await top(), 'front', document, spatial, guide)).base64);
    // Desde el punto de la estancia este menos un 25 % de margen hasta los bordes derecho e inferior (fachada cortada).
    expect([info.width, info.height]).toEqual([120, 60]);
    const at = (30 * info.width + info.width - 30) * 3;
    expect([data[at], data[at + 2]]).toEqual([30, 200]);
    // Desde la izquierda, la fachada cortada (oeste) entra aunque la estancia vista sea la del este.
    const fromLeft = await raw((await acceptedTopForView(await top(), 'left', document, spatial, guide)).base64);
    expect([fromLeft.info.width, fromLeft.info.height]).toEqual([60, 240]);
  });
  it('no recorta cuando la cámara ve casi toda la planta', async () => {
    const guide: CameraRoomGuide = { rooms: [{ id: 'este', name: 'este', x: .5, y: .5 }, { id: 'oeste', name: 'oeste', x: .2, y: .5 }] };
    const plan = await top();
    expect(await acceptedTopForView(plan, 'front', document, spatial, guide)).toBe(plan);
  });
});
