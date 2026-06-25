import { describe, it, expect } from 'vitest';
import { groupHistory } from '@/lib/history-grouping';

// Diseño mínimo con su vínculo de origen.
function d(id: string, sourceImageId: string | null) {
  return { id, sourceImageId };
}

describe('groupHistory — agrupación de historial origen→diseño', () => {
  it('agrupa cada diseño bajo su imagen de origen resuelta', () => {
    const urls = new Map([
      ['img1', 'u1'],
      ['img2', 'u2'],
    ]);
    const groups = groupHistory(
      [{ id: 'img1' }, { id: 'img2' }],
      [d('a', 'img1'), d('b', 'img1'), d('c', 'img2')],
      urls,
    );

    const g1 = groups.find((g) => g.sourceImageId === 'img1');
    const g2 = groups.find((g) => g.sourceImageId === 'img2');
    expect(g1?.deliverables.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g1?.sourceImageUrl).toBe('u1');
    expect(g2?.deliverables.map((x) => x.id)).toEqual(['c']);
  });

  it('mantiene una imagen sin diseños como grupo vacío (subiste, no generaste)', () => {
    const groups = groupHistory([{ id: 'img1' }], [], new Map([['img1', 'u1']]));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.deliverables).toEqual([]);
  });

  it('envía los diseños sin vínculo al grupo sin origen (datos v1)', () => {
    const groups = groupHistory([], [d('a', null), d('b', null)], new Map());
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sourceImageId).toBeNull();
    expect(groups[0]?.deliverables.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('un vínculo cuya imagen no se resolvió (storage caído/borrada) cae a sin origen', () => {
    // d('a') apunta a img1, pero img1 no está en el mapa de URLs resueltas.
    const groups = groupHistory([{ id: 'img2' }], [d('a', 'img1')], new Map([['img2', 'u2']]));
    const orphan = groups.find((g) => g.sourceImageId === null);
    const img2 = groups.find((g) => g.sourceImageId === 'img2');
    expect(orphan?.deliverables.map((x) => x.id)).toEqual(['a']);
    expect(img2?.deliverables).toEqual([]);
  });

  it('no añade grupo sin origen si no hay huérfanos', () => {
    const groups = groupHistory([{ id: 'img1' }], [d('a', 'img1')], new Map([['img1', 'u1']]));
    expect(groups.some((g) => g.sourceImageId === null)).toBe(false);
  });
});
