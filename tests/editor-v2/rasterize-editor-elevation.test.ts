import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { rasterizeEditorElevation, sectionRooms } from '@/server/agent/editor-v2/rasterize-editor-elevation';

// Recinto de 6 × 4 m con una ventana solo en la fachada frontal (borde inferior del plano).
const room = () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const vertex = (id: string) => doc.vertices.find((item) => item.id === id)!;
  const front = doc.walls.find((wall) => vertex(wall.startVertexId).y === 4000 && vertex(wall.endVertexId).y === 4000)!;
  doc.openings = [{ id: 'v1', kind: 'ventana', wallId: front.id, position: .5, widthMm: 1200, dimensionalOrigin: 'physical' }];
  return doc;
};
const windowPixels = async (base64: string) => {
  const { data, info } = await sharp(Buffer.from(base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < info.width * info.height; i++)
    if (Math.abs(data[i * 3]! - 0x8f) < 10 && Math.abs(data[i * 3 + 1]! - 0xc3) < 10 && Math.abs(data[i * 3 + 2]! - 0xdd) < 10) count++;
  return count;
};

describe('alzado ortogonal de una fachada', () => {
  it('la sección sin techo no inventa una losa continua por encima de los muros', async () => {
    const section = (await rasterizeEditorElevation(room(), 'front', { cut: true, furniture: false }))!;
    const { data, info } = await sharp(Buffer.from(section.base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let maximum = 0;
    for (let y = 0; y < info.height / 2; y++) {
      let run = 0;
      for (let x = 0; x < info.width; x++) {
        const at = (y * info.width + x) * info.channels;
        const dark = [0x2d, 0x34, 0x36].every((channel, i) => Math.abs(data[at + i]! - channel) < 5);
        run = dark ? run + 1 : 0; maximum = Math.max(maximum, run);
      }
    }
    expect(maximum).toBeLessThan(info.width / 4);
  });
  it('dibuja solo los huecos de la fachada orientada a la cámara', async () => {
    const front = (await rasterizeEditorElevation(room(), 'front'))!;
    const back = (await rasterizeEditorElevation(room(), 'back'))!;
    expect(front.width).toBe(1600);
    expect(await windowPixels(front.base64)).toBeGreaterThan(500);
    expect(await windowPixels(back.base64)).toBe(0);
  });
  it('en la sección retira la fachada de cámara y dibuja los huecos del fondo', async () => {
    const doc = room();
    const vertex = (id: string) => doc.vertices.find((item) => item.id === id)!;
    const back = doc.walls.find((wall) => vertex(wall.startVertexId).y === 0 && vertex(wall.endVertexId).y === 0)!;
    doc.openings.push({ id: 'v2', kind: 'ventana', wallId: back.id, position: .25, widthMm: 800, dimensionalOrigin: 'physical' });
    const facade = await windowPixels((await rasterizeEditorElevation(doc, 'front'))!.base64);
    const section = await windowPixels((await rasterizeEditorElevation(doc, 'front', { cut: true }))!.base64);
    // La sección muestra solo la ventana del fondo, más estrecha que la de la fachada retirada.
    expect(section).toBeGreaterThan(200);
    expect(section).toBeLessThan(facade);
  });
  it('nombra de izquierda a derecha las estancias que abre la sección', () => {
    const doc = addWallPath(addWallPath(emptyEditorDocument(),
      [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true), [{ x: 4000, y: 0 }, { x: 4000, y: 4000 }]);
    doc.labels = [{ id: 'l1', x: 6000, y: 2000, text: 'Cocina' }, { id: 'l2', x: 2000, y: 2000, text: 'Salón' }];
    expect(sectionRooms(doc, 'front').map((item) => item.name)).toEqual(['Salón', 'Cocina']);
    expect(sectionRooms(doc, 'back').map((item) => item.name)).toEqual(['Cocina', 'Salón']);
  });
  it('ordena por donde cada estancia toca la fachada, aunque su contorno cruce la casa', () => {
    // El pasillo en L toca la fachada frontal a la derecha, pero su brazo trasero llega hasta el muro izquierdo.
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
    doc = addWallPath(addWallPath(addWallPath(doc, [{ x: 0, y: 2000 }, { x: 6000, y: 2000 }]),
      [{ x: 6000, y: 2000 }, { x: 6000, y: 4000 }]), [{ x: 1000, y: 2000 }, { x: 1000, y: 4000 }]);
    doc.labels = [{ id: 'l1', x: 4000, y: 1000, text: 'Pasillo' }, { id: 'l2', x: 3500, y: 3000, text: 'Cocina' },
      { id: 'l3', x: 500, y: 3000, text: 'Lavadero' }];
    expect(sectionRooms(doc, 'front').map((item) => item.name)).toEqual(['Lavadero', 'Cocina', 'Pasillo']);
  });
  it('no genera imagen sin muros', async () => {
    expect(await rasterizeEditorElevation(emptyEditorDocument(), 'left')).toBeNull();
  });
});
