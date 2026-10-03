import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type TerrainSurface } from '@/lib/editor-document/schema';
import { addTerrainSurface, updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { addWallPath, nudgeSpatialEntities } from '@/canvas/editor-v2/editing-operations';
import { resizeTerrainSurface, snapTerrainMove, snapTerrainResize, terrainAnchors } from '@/canvas/editor-v2/terrain-transform';
import { magneticReferences } from '@/canvas/editor-v2/magnetic-alignment';
import { selectEntitiesInRectangle, selectableEntityIds } from '@/canvas/editor-v2/marquee-selection';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { planElementIndex } from '@/lib/editor-document/plan-element-index';

const paving: TerrainSurface = { id: 'paving', name: 'Pavimento exterior', x: 1000, y: 2000, widthMm: 4000, depthMm: 3000,
  texture: 'none', color: '#ffffff', tileSizeMm: 1000, rotation: 45 };
const other = { ...paving, id: 'ground', x: 8000, y: 9000, widthMm: 2000, depthMm: 2000 };
const document = () => addTerrainSurface(emptyEditorDocument(), paving);

describe('manipulación de terreno y pavimento', () => {
  it('el giro de la textura no altera los imanes, esquinas o selección de la superficie', () => {
    expect(terrainAnchors(paving)).toContainEqual({ x: 5000, y: 5000 });
    expect(magneticReferences(document())).toContainEqual({ x: 3000, y: 3500 });
    expect(selectableEntityIds(document())).toContain('paving');
    expect(selectEntitiesInRectangle(document(), { x: 1000, y: 2000 }, { x: 5000, y: 5000 })).toEqual(['paving']);
    expect(selectEntitiesInRectangle(document(), { x: 1001, y: 2000 }, { x: 5000, y: 5000 })).toEqual([]);
  });
  it('ajusta el borde al de otro terreno y puede desactivar los imanes', () => {
    const doc = addTerrainSurface(document(), other), delta = { x: 2920, y: 0 };
    expect(snapTerrainMove(doc, paving, delta, .1, true).delta.x).toBe(3000);
    expect(snapTerrainMove(doc, paving, delta, .1, false)).toMatchObject({ delta, guides: [] });
  });
  it('no se atrae a su posición anterior', () => {
    expect(snapTerrainMove(document(), paving, { x: 25, y: 30 }, .1, true)).toMatchObject({ delta: { x: 25, y: 30 }, guides: [] });
  });
  it.each([.02, .1, .5])('mantiene el alcance magnético en pantalla a escala %s', scale => {
    const doc = addTerrainSurface(document(), other);
    expect(snapTerrainMove(doc, paving, { x: 3000 - 9 / scale, y: 0 }, scale, true).delta.x).toBe(3000);
    expect(snapTerrainMove(doc, paving, { x: 3000 - 11 / scale, y: 0 }, scale, true).delta.x).not.toBe(3000);
  });
  it('redimensiona desde una esquina conservando la opuesta y los acabados', () => {
    const resized = resizeTerrainSurface(paving, 0, { x: 500, y: 1000 });
    expect(resized).toMatchObject({ x: 500, y: 1000, widthMm: 4500, depthMm: 4000, rotation: 45, texture: 'none' });
    expect(paving).toMatchObject({ x: 1000, y: 2000, widthMm: 4000, depthMm: 3000 });
  });
  it('los cuatro tiradores laterales cambian una sola dimensión', () => {
    expect(resizeTerrainSurface(paving, 1, { x: 7000, y: 1000 })).toMatchObject({ x: 1000, widthMm: 4000, y: 1000, depthMm: 4000 });
    expect(resizeTerrainSurface(paving, 3, { x: 7000, y: 1000 })).toMatchObject({ x: 1000, widthMm: 6000, y: 2000, depthMm: 3000 });
    expect(resizeTerrainSurface(paving, 5, { x: 7000, y: 6000 })).toMatchObject({ x: 1000, widthMm: 4000, y: 2000, depthMm: 4000 });
    expect(resizeTerrainSurface(paving, 7, { x: 500, y: 9000 })).toMatchObject({ x: 500, widthMm: 4500, y: 2000, depthMm: 3000 });
  });
  it('admite cruzar el borde opuesto sin dimensiones negativas y respeta el máximo', () => {
    expect(resizeTerrainSurface(paving, 0, { x: 6000, y: 6000 })).toMatchObject({ x: 5000, y: 5000, widthMm: 1000, depthMm: 1000 });
    expect(resizeTerrainSurface(paving, 4, { x: 1000, y: 2000 })).toMatchObject({ widthMm: 50, depthMm: 50 });
    expect(resizeTerrainSurface(paving, 4, { x: 900000, y: 900000 })).toMatchObject({ widthMm: 200000, depthMm: 200000 });
  });
  it('redimensiona hasta la cara de un muro con guía de acople', () => {
    const doc = addWallPath(document(), [{ x: 6000, y: 1000 }, { x: 6000, y: 7000 }]);
    const face = 6000 - doc.walls[0]!.thicknessMm / 2;
    const result = snapTerrainResize(doc, paving, 3, { x: face + 10, y: 3500 }, .1, true);
    expect(result.surface.x + result.surface.widthMm).toBe(face);
    expect(result.surface.depthMm).toBe(3000);
    expect(result.guides.some(guide => guide.from.x === face)).toBe(true);
    expect(snapTerrainResize(doc, paving, 3, { x: face + 10, y: 3500 }, .1, false).surface.widthMm).toBe(face + 10 - paving.x);
  });
  it('mueve una selección de terrenos una sola vez y permite deshacer en el store', () => {
    const source = addTerrainSurface(document(), other), store = createEditorStore(source);
    store.getState().apply(nudgeSpatialEntities(source, ['paving', 'ground'], { x: 10, y: -10 }));
    expect(store.getState().document.terrainSurfaces?.map(item => [item.x, item.y])).toEqual([[1010, 1990], [8010, 8990]]);
    store.getState().undo();
    expect(store.getState().document.terrainSurfaces).toEqual(source.terrainSurfaces);
    const changed = resizeTerrainSurface(paving, 4, { x: 6500, y: 6000 });
    store.getState().apply(updateTerrainSurface(store.getState().document, paving.id, { widthMm: changed.widthMm, depthMm: changed.depthMm }));
    expect(store.getState().document.terrainSurfaces?.[0]?.widthMm).toBe(5500);
    store.getState().undo();
    expect(store.getState().document.terrainSurfaces?.[0]?.widthMm).toBe(4000);
  });
  it('las cotas manuales se encuentran por su distancia y se centran entre sus extremos', () => {
    const doc = document(); doc.dimensions.push({ id: 'measurement', from: { x: 0, y: 0 }, to: { x: 3000, y: 4000 } });
    expect(planElementIndex(doc, []).find(item => item.id === 'measurement')).toEqual({ id: 'measurement', label: 'Medida · 5.00 m', group: 'Medidas', point: { x: 1500, y: 2000 } });
  });
});
