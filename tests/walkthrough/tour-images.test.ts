import { describe, expect, it, vi } from 'vitest';
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: async (payload: { assetUrl?: string }) => payload.assetUrl ?? null }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: vi.fn() }));
import { tourImagesFromRows } from '@/server/walkthrough/tour-images';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';

function fixture() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5000, y: 0 },
    { id: 'c', x: 5000, y: 4000 }, { id: 'd', x: 0, y: 4000 }];
  doc.walls = doc.vertices.map((v, i) => ({ id: `w${i}`, startVertexId: v.id,
    endVertexId: doc.vertices[(i + 1) % 4]!.id, thicknessMm: 150, dimensionalOrigin: 'physical' }));
  doc.labels = [{ id: 'label', x: 2500, y: 2000, text: 'Cocina' }];
  const room = roomInteriorCameras(doc)[0]!;
  const view = { preset: 'custom', position: room.camera.position, focus: room.camera.focus,
    levelId: room.camera.levelId, quaternion: [0, 0, 0, 1], fov: room.camera.fovDeg,
    aspect: 1.6, allLevels: false, cutaway: false, lighting: 'daylight' };
  const row = { id: 'old', createdAt: new Date('2026-09-30T12:00:00Z'), payload: { assetUrl: 'https://example.com/old.png',
    generation: { documentRevision: 144, view, options: { interiorRoomIds: [room.roomId], freedom: 'strict' } } } };
  return { doc, row, room };
}

describe('imágenes antiguas del montaje', () => {
  it('excluye del montaje las imágenes descartadas en una revisión posterior', async () => {
    const { row } = fixture();
    Object.assign(row.payload.generation, { review: { status: 'rejected', reason: 'Mobiliario irreconocible', reviewedAt: '2026-10-01T21:00:00Z' } });
    const read = vi.fn();
    expect(await tourImagesFromRows([row], read)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it('recupera estancia desde la revisión original y comparte la lectura del historial', async () => {
    const { doc, row, room } = fixture();
    const read = vi.fn(async () => doc);
    const shots = await tourImagesFromRows([row, { ...row, id: 'other' }], read);
    expect(read).toHaveBeenCalledExactlyOnceWith(144);
    expect(shots[0]).toMatchObject({ ambient: 'Cocina · 20 m²', ambientId: room.roomId, revision: 144 });
  });
  it('usa la identidad persistida sin consultar el historial', async () => {
    const { row, room } = fixture();
    Object.assign(row.payload.generation.view, { roomId: room.roomId, roomName: 'Cocina', zones: [{ id: 'z', name: 'Zona cocina' }] });
    const read = vi.fn();
    expect((await tourImagesFromRows([row], read))[0]).toMatchObject({ ambient: 'Cocina', coveredAmbients: ['Cocina', 'Zona cocina'] });
    expect(read).not.toHaveBeenCalled();
  });
  it('no inventa identidad si falta la revisión o la cámara no coincide', async () => {
    const { doc, row } = fixture();
    expect((await tourImagesFromRows([row], async () => null))[0]!.ambient).toBe('Interior sin identificar');
    row.payload.generation.view.position = [100, 100, 100];
    expect((await tourImagesFromRows([row], async () => doc))[0]!.ambient).toBe('Interior sin identificar');
  });
  it('propaga fallos de lectura y descarta archivos ausentes', async () => {
    const { row } = fixture();
    await expect(tourImagesFromRows([row], async () => { throw new Error('BD no disponible'); })).rejects.toThrow('BD no disponible');
    expect(await tourImagesFromRows([{ ...row, payload: {} }])).toEqual([]);
  });
});
