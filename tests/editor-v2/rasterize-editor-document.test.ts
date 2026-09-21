import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';

describe('rasterizeEditorDocument', () => {
  it('rasteriza un plano de 60 x 40 metros sin superar el límite de píxeles de sharp', async () => {
    // Sin width/height en el SVG, 60 000 x 40 000 mm se dibujaban como 2 400 Mpx.
    const doc = emptyEditorDocument();
    doc.vertices.push(
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 60_000, y: 0 },
      { id: 'c', x: 60_000, y: 40_000 },
      { id: 'd', x: 0, y: 40_000 },
    );
    doc.walls.push(
      {
        id: 'w1',
        startVertexId: 'a',
        endVertexId: 'b',
        thicknessMm: 150,
        dimensionalOrigin: 'physical',
      },
      {
        id: 'w2',
        startVertexId: 'b',
        endVertexId: 'c',
        thicknessMm: 150,
        dimensionalOrigin: 'physical',
      },
    );
    const result = await rasterizeEditorDocument(doc);
    const meta = await sharp(Buffer.from(result.base64, 'base64')).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1280);
    expect(result.aspectRatio).toBeTruthy();
  });
});
