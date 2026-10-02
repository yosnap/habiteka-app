import { describe, expect, it } from 'vitest';
import { addWallPath, moveEntity, nudgeSpatialEntities } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { followFurnitureOnMovedWalls } from '@/canvas/editor-v2/wall-furniture-follow';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';

function roomWithFurniture() {
  const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 5000 }, { x: 0, y: 5000 },
  ], true));
  doc.furniture = [
    { id: 'bath', kind: 'asset-banera', catalogId: 'habiteka:asset:banera', x: 1000, y: -75,
      widthMm: 1700, depthMm: 750, rotation: 0, dimensionalOrigin: 'physical',
      heightMm: 600, elevationMm: 0, color: '#8ea69b' },
    { id: 'cabinet', kind: 'cabinet', x: 5125, y: 1500, widthMm: 800, depthMm: 600,
      rotation: 0, dimensionalOrigin: 'physical', heightMm: 900, elevationMm: 0, color: '#8ea69b' },
    { id: 'far', kind: 'chair', x: 3500, y: 3000, widthMm: 500, depthMm: 500,
      rotation: 0, dimensionalOrigin: 'physical', heightMm: 800, elevationMm: 0, color: '#8ea69b' },
  ];
  return doc;
}

const furniture = (doc: ReturnType<typeof roomWithFurniture>, id: string) => doc.furniture.find((item) => item.id === id)!;

describe('muebles apoyados al desplazar paredes', () => {
  it.each([200, -200])('arrastra una bañera que ya solapa 15 cm al mover un muro %i mm', (dy) => {
    const source = roomWithFurniture(), store = createEditorStore(source);
    const candidate = moveEntity(source, source.walls[0]!.id, { x: 0, y: dy });
    expect(furniture(candidate, 'bath').y).toBe(75 + dy);
    expect(furniture(candidate, 'far').y).toBe(3000);
    store.getState().apply(candidate);
    expect(furniture(store.getState().document, 'bath').y).toBe(75 + dy);
    store.getState().undo();
    expect(store.getState().document).toEqual(source);
  });

  it('arrastra una selección de muros y sus muebles una sola vez', () => {
    const source = roomWithFurniture(), store = createEditorStore(source);
    const selected = [source.walls[0]!.id, source.walls[1]!.id];
    const candidate = nudgeSpatialEntities(source, selected, { x: -200, y: 100 });
    store.getState().apply(candidate);
    const next = store.getState().document;
    expect(furniture(next, 'bath')).toMatchObject({ x: 800, y: 175 });
    expect(furniture(next, 'cabinet')).toMatchObject({ x: 4925, y: 1600 });
    expect(furniture(next, 'far')).toMatchObject({ x: 3500, y: 3000 });
  });

  it('no duplica el movimiento si el mueble también estaba seleccionado', () => {
    const source = roomWithFurniture();
    const candidate = nudgeSpatialEntities(source, [source.walls[0]!.id, 'bath'], { x: 0, y: 100 });
    expect(furniture(candidate, 'bath').y).toBe(25);
  });

  it('mantiene con el armario los objetos colocados encima', () => {
    const source = roomWithFurniture();
    source.furniture.push({ id: 'lamp', kind: 'lamp', x: 5350, y: 1650, widthMm: 200, depthMm: 200,
      rotation: 0, dimensionalOrigin: 'physical', heightMm: 200, elevationMm: 900,
      color: '#8ea69b', hostId: 'cabinet' });
    const store = createEditorStore(source);
    store.getState().apply(nudgeSpatialEntities(source, [source.walls[1]!.id], { x: -200, y: 0 }));
    expect(furniture(store.getState().document, 'cabinet').x).toBe(4925);
    expect(furniture(store.getState().document, 'lamp').x).toBe(5150);
  });

  it('mueve también los módulos de cocina apoyados en la pared', () => {
    const source = upgradeKitchenDocument(roomWithFurniture());
    source.furniture = [];
    source.kitchenRuns!.push(kitchenRunDefaults({ id: 'run', x: 1000, y: 75, widthMm: 2000, rotation: 0 }));
    const store = createEditorStore(source);
    store.getState().apply(moveEntity(source, source.walls[0]!.id, { x: 0, y: 200 }));
    expect(store.getState().document.kitchenRuns![0]!.y).toBe(275);
  });

  it('no arrastra muebles cuando solo cambia un extremo del muro', () => {
    const source = roomWithFurniture(), candidate = structuredClone(source);
    candidate.vertices.find((vertex) => vertex.id === source.walls[0]!.endVertexId)!.y += 200;
    followFurnitureOnMovedWalls(source, candidate, [source.walls[0]!.id]);
    expect(furniture(candidate, 'bath').y).toBe(-75);
  });
});
