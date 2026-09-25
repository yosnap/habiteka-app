import { describe, expect, it } from 'vitest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { collisions } from '@/canvas/editor-v2/spatial-placement';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';

function twoRooms() {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 8000, y: 0 },
    { id: 'd', x: 8000, y: 5000 }, { id: 'e', x: 4000, y: 5000 }, { id: 'f', x: 0, y: 5000 },
  ];
  doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']]
    .map(([startVertexId, endVertexId], index) => ({ id: `w${index}`, startVertexId: startVertexId!, endVertexId: endVertexId!,
      thicknessMm: 150, dimensionalOrigin: 'physical' as const }));
  doc.furniture = [
    { id: 'left', kind: 'cabinet', x: 3000, y: 1500, widthMm: 925, depthMm: 1000, rotation: 0, dimensionalOrigin: 'physical' },
    { id: 'right', kind: 'bed', x: 4075, y: 1500, widthMm: 900, depthMm: 1200, rotation: 0, dimensionalOrigin: 'physical' },
    { id: 'far', kind: 'chair', x: 1000, y: 3000, widthMm: 500, depthMm: 500, rotation: 0, dimensionalOrigin: 'physical' },
    { id: 'on-top', kind: 'lamp', x: 3300, y: 1700, widthMm: 200, depthMm: 200, rotation: 0,
      dimensionalOrigin: 'physical' },
  ];
  const upgraded = upgradeSpatialDocument(doc);
  Object.assign(upgraded.furniture.find((item) => item.id === 'on-top')!, { hostId: 'left', elevationMm: 800, heightMm: 200 });
  return upgraded;
}

describe('muebles al engrosar paredes', () => {
  it('separa en una operación los muebles de ambas caras del tabique y arrastra los objetos apoyados', () => {
    const source = twoRooms(), store = createEditorStore(source), candidate = structuredClone(source);
    candidate.walls.find((wall) => wall.id === 'w6')!.thicknessMm = 250;
    store.getState().apply(candidate);
    const next = store.getState().document;
    const byId = (id: string) => next.furniture.find((item) => item.id === id)!;
    expect(byId('left').x).toBeLessThan(3000);
    expect(byId('left').x).toBeGreaterThan(2945);
    expect(byId('right').x).toBeGreaterThan(4075);
    expect(byId('right').x).toBeLessThan(4130);
    expect(byId('far').x).toBe(1000);
    expect(byId('on-top').x - byId('left').x).toBeCloseTo(300);
    expect(collisions(next).size).toBe(0);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document).toEqual(source);
  });

  it('no mueve muebles al adelgazar un muro ni al editar otras propiedades', () => {
    const source = twoRooms(), store = createEditorStore(source), thinner = structuredClone(source);
    thinner.walls.find((wall) => wall.id === 'w6')!.thicknessMm = 100;
    store.getState().apply(thinner);
    expect(store.getState().document.furniture).toEqual(source.furniture);
    const taller = structuredClone(store.getState().document);
    taller.walls.find((wall) => wall.id === 'w6')!.heightMm = 3000;
    store.getState().apply(taller);
    expect(store.getState().document.furniture).toEqual(source.furniture);
  });

  it('respeta la huella girada al separar un mueble de una fachada', () => {
    const source = twoRooms();
    source.furniture = [{ ...source.furniture[0]!, id: 'rotated', x: 2000, y: 75,
      widthMm: 1000, depthMm: 500, rotation: 90 }];
    const store = createEditorStore(source), candidate = structuredClone(source);
    candidate.walls.find((wall) => wall.id === 'w0')!.thicknessMm = 250;
    store.getState().apply(candidate);
    const moved = store.getState().document.furniture[0]!;
    expect(moved.y).toBeGreaterThan(120);
    expect(moved.y).toBeLessThan(130);
    expect(moved.x).toBe(2000);
    expect(collisions(store.getState().document).size).toBe(0);
  });

  it('desplaza también los módulos de cocina que tocan la pared', () => {
    const source = upgradeKitchenDocument(twoRooms());
    source.furniture = [];
    source.kitchenRuns!.push(kitchenRunDefaults({ id: 'run', x: 1000, y: 75, widthMm: 2000, rotation: 0 }));
    const store = createEditorStore(source), candidate = structuredClone(source);
    candidate.walls.find((wall) => wall.id === 'w0')!.thicknessMm = 250;
    store.getState().apply(candidate);
    expect(store.getState().document.kitchenRuns![0]!.y).toBeGreaterThan(120);
    expect(collisions(store.getState().document).size).toBe(0);
  });

  it('rechaza el engrosamiento si otro mueble impide el desplazamiento seguro', () => {
    const source = twoRooms();
    source.furniture.push({ ...source.furniture[2]!, id: 'blocker', x: 2700, y: 1500,
      widthMm: 290, depthMm: 1000 });
    const store = createEditorStore(source), candidate = structuredClone(source);
    candidate.walls.find((wall) => wall.id === 'w6')!.thicknessMm = 250;
    expect(() => store.getState().apply(candidate)).toThrow('atraviesa');
    expect(store.getState().document).toEqual(source);
  });
});
