import { describe, expect, it } from 'vitest';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { assertSpatialPlacement, collisions, placeNewObject } from '@/canvas/editor-v2/spatial-placement';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';

const doorIds = new Set(['entry', 'living-kitchen', 'living-bedroom', 'kitchen-bath']);
const doorPairs = (document: ReturnType<typeof visualSampleDocument>) =>
  [...collisions(document).keys()].map((key) => JSON.parse(key) as [string, string])
    .filter(([first, second]) => doorIds.has(first) || doorIds.has(second));

describe('espacio de giro de puertas en el Editor v2', () => {
  it('la muestra deja libre el barrido de todas las puertas', () => {
    expect(doorPairs(visualSampleDocument())).toEqual([]);
  });

  it('impide colocar la mesilla y la bañera dentro del giro', () => {
    const document = visualSampleDocument();
    for (const [id, x, y, door] of [
      ['nightstand', 2700, 4500, 'living-bedroom'],
      ['bath', 6100, 4600, 'kitchen-bath'],
    ] as const) {
      const candidate = structuredClone(document);
      Object.assign(candidate.furniture.find((item) => item.id === id)!, { x, y });
      expect(doorPairs(candidate).some((pair) => pair.includes(id) && pair.includes(door))).toBe(true);
      expect(() => assertSpatialPlacement(document, candidate)).toThrow(/El giro de la puerta choca/);
    }
  });

  it('busca otra posición al añadir un mueble donde gira una puerta', () => {
    const document = visualSampleDocument();
    const item = { ...document.furniture.find((furniture) => furniture.id === 'nightstand')!,
      id: 'another-nightstand', x: 2700, y: 4500 };
    const candidate = { ...document, furniture: [...document.furniture, item] };
    const placed = placeNewObject(document, candidate, item.id);
    expect(placed.furniture.find((furniture) => furniture.id === item.id)).not.toMatchObject({ x: 2700, y: 4500 });
    expect(doorPairs(placed).some((pair) => pair.includes(item.id))).toBe(false);
  });

  it('respeta ambos lados de giro con bisagra izquierda y derecha', () => {
    for (const hinge of ['left', 'right'] as const) for (const swing of ['left', 'right'] as const) {
      const furniture = { id: 'obstacle', kind: 'asset-mesilla', catalogId: 'habiteka:asset:mesilla',
        x: 1450, y: swing === 'left' ? 350 : -450, rotation: 0,
        widthMm: 100, depthMm: 100, heightMm: 500, dimensionalOrigin: 'physical' as const };
      const document: EditorDocument = {
        ...emptyEditorDocument(),
        vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }],
        walls: [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 120, dimensionalOrigin: 'physical' }],
        openings: [{ id: 'door', wallId: 'wall', kind: 'puerta', position: .5, widthMm: 900,
          hinge, swing, dimensionalOrigin: 'physical' }],
        furniture: [furniture],
      };
      expect([...collisions(document).keys()]).toContain(JSON.stringify(['door', 'obstacle']));
      document.furniture[0]!.y *= -1;
      expect([...collisions(document).keys()]).not.toContain(JSON.stringify(['door', 'obstacle']));
    }
  });

  it('mantiene la hoja cerrada como obstáculo aunque el giro sea cero', () => {
    const document: EditorDocument = {
      ...emptyEditorDocument(),
      vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }],
      walls: [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 120, dimensionalOrigin: 'physical' }],
      openings: [{ id: 'door', wallId: 'wall', kind: 'puerta', position: .5, widthMm: 900,
        openAngleDeg: 0, dimensionalOrigin: 'physical' }],
      furniture: [{ id: 'obstacle', kind: 'asset-mesilla', catalogId: 'habiteka:asset:mesilla',
        x: 1450, y: -30, rotation: 0, widthMm: 100, depthMm: 60, heightMm: 500,
        dimensionalOrigin: 'physical' }],
    };
    expect([...collisions(document).keys()]).toContain(JSON.stringify(['door', 'obstacle']));
  });
});
