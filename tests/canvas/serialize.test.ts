import { describe, it, expect } from 'vitest';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import { type CanvasDoc, CANVAS_SCHEMA_VERSION } from '@/canvas/types';

const sample: CanvasDoc = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  baseImage: { url: 'https://cdn.test/base.png', width: 800, height: 600 },
  strokes: [{ id: 's1', points: [0, 0, 10, 10], color: '#ff0000', width: 3 }],
  objects: [{ id: 'o1', kind: 'wall', x: 5, y: 5, width: 100, height: 12, rotation: 0 }],
  products: [{ id: 'p1', marketplaceItemId: 'm1', x: 20, y: 30, targetRef: 'salon' }],
  selection: { type: 'object', objectId: 'o1' },
};

describe('serialización del canvas', () => {
  it('round-trip CanvasDoc → jsonb → CanvasDoc conserva el contenido', () => {
    const json = JSON.parse(JSON.stringify(serializeCanvas(sample)));
    const back = deserializeCanvas(json);

    expect(back.schemaVersion).toBe(CANVAS_SCHEMA_VERSION);
    expect(back.baseImage).toEqual(sample.baseImage);
    expect(back.strokes).toEqual(sample.strokes);
    expect(back.objects).toEqual(sample.objects);
    expect(back.products).toEqual(sample.products);
  });

  it('no persiste la selección (estado de UI efímero)', () => {
    const json = serializeCanvas(sample) as { selection: unknown };
    expect(json.selection).toBeNull();
  });

  it('deserializa de forma defensiva un payload corrupto sin romper', () => {
    const back = deserializeCanvas({
      strokes: [{ id: 's', points: ['x', 1, 2] }, 'basura'],
      objects: [
        { id: 'o', kind: 'invalido' },
        { id: 'o2', kind: 'door', x: 1 },
      ],
      products: [{ marketplaceItemId: 'sin-id' }],
    });
    // Trazo: filtra puntos no numéricos; objeto inválido descartado; el válido entra.
    expect(back.strokes[0]?.points).toEqual([1, 2]);
    expect(back.objects).toHaveLength(1);
    expect(back.objects[0]?.kind).toBe('door');
    expect(back.products).toHaveLength(0); // producto sin id se descarta
  });

  it('un payload no-objeto devuelve un documento vacío', () => {
    expect(deserializeCanvas(null).objects).toHaveLength(0);
    expect(deserializeCanvas('texto').strokes).toHaveLength(0);
  });
});
