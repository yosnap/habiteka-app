import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { isPorchAddon, porchAccess, porchFloorAt, porchPlanDepth } from '@/lib/editor-document/porch-volumes';
import { furnitureSceneBoxes } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { assertSpatialPlacement, collisions } from '@/canvas/editor-v2/spatial-placement';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { furnitureDesignContext } from '@/lib/editor-document/furniture-context';

const entry = OUTDOOR_CATALOG.find((e) => e.kind === 'porche-entrada')!;
const fixture = () => addFurniture(emptyEditorDocument(), entry, { x: 0, y: 0 });
describe('porche de acceso', () => {
  it('ofrece un modelo real con cuatro apoyos y cubierta continua y deja paso bajo él', () => {
    const doc = fixture(), porch = doc.furniture[0]!, volumes = furnitureVolumes(porch), model = furnitureModel(porch)!;
    expect(existsSync(`public${model.url.split('?')[0]}`)).toBe(true);
    expect(existsSync(`public${model.thumbnailUrl!.split('?')[0]}`)).toBe(true);
    expect(model.url).toContain('?v=');
    expect(model.tintMaterialNames).toEqual(['blanco']);
    expect(volumes.filter((v) => v.part === 'post' && v.bottom === 0)).toHaveLength(4);
    expect(volumes.some((v) => v.widthMm === 3000 && v.depthMm === 2000 && v.bottom > 2500 && v.top === 2700)).toBe(true);
    const low: Furniture = { id: 'mueble', kind: 'box', x: 1300, y: 800, widthMm: 400, depthMm: 400,
      heightMm: 1000, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: '#8ea69b' };
    expect(() => assertSpatialPlacement(doc, { ...doc, furniture: [...doc.furniture, low] })).not.toThrow();
    expect(collisions({ ...doc, furniture: [...doc.furniture, { ...low, x: 100, y: 100 }] }).size).toBe(1);
    expect(walkthroughNavigation(doc).free({ x: 1500, y: 1000 })).toBe(true);
    expect(walkthroughNavigation(doc).free({ x: 240, y: 240 })).toBe(false);
  });
  it('la cota eleva columnas y cubierta, rellena la base y genera tres peldaños más la llegada a 60 cm', () => {
    const doc = fixture(), id = doc.furniture[0]!.id;
    const raised = updateFurniture(doc, id, { elevationMm: 600, porchSteps: true }), porch = raised.furniture[0]!;
    const volumes = furnitureVolumes(porch), steps = volumes.filter((v) => v.part === 'porch-step');
    expect(steps.map((v) => v.top)).toEqual([150, 300, 450]);
    expect(volumes.find((v) => v.part === 'porch-floor')).toMatchObject({ bottom: 0, top: 600 });
    expect(volumes.filter((v) => v.part === 'post' && v.bottom === 600)).toHaveLength(4);
    expect(porchPlanDepth(porch)).toBe(2900);
    expect(furnitureSceneBoxes(porch).filter((b) => isPorchAddon(b.boundaryPart))).toHaveLength(4);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(raised)))).toEqual(raised);
    expect(furnitureDesignContext(raised).levels[0]!.furniture[0]!.porch).toMatchObject({
      columns: 4, closedSides: 0, floorElevationMm: 600, frontSteps: true, stepRunMm: 900,
      doorway: 'separate-wall-opening-at-rear',
    });
    const store = createEditorStore(doc); store.getState().apply(raised); store.getState().undo();
    expect(store.getState().document).toEqual(doc); store.getState().redo(); expect(store.getState().document).toEqual(raised);
    const flush = updateFurniture(raised, id, { elevationMm: 0 }).furniture[0]!;
    expect(furnitureVolumes(flush).filter((v) => v.part === 'porch-step')).toEqual([]);
    expect(porchPlanDepth(flush)).toBe(2000);
    expect(furnitureDesignContext({ ...raised, furniture: [flush] }).levels[0]!.furniture[0]!.porch?.frontSteps).toBe(false);
  });
  it.each([0, 37, 90, 180])('el acceso gira junto al porche (%s°) y permite subir, pero bloquea saltar por el lateral', (rotation) => {
    let doc = fixture(); doc = updateFurniture(doc, doc.furniture[0]!.id, { elevationMm: 600, porchSteps: true, rotation });
    const porch = doc.furniture[0]!, point = (x: number, y: number) => localToWorld(porch, { x, y });
    expect(porchFloorAt(porch, point(1500, 2800))).toMatchObject({ floorMm: 150 });
    const nav = walkthroughNavigation(doc);
    expect(nav.floorAt(point(1500, 1000))).toBe(600);
    expect(nav.segmentFree(point(1500, 2800), point(1500, 1000))).toBe(true);
    expect(nav.segmentFree(point(600, 2050), point(600, 1950))).toBe(false);
    expect(porchAccess(porch)).toMatchObject({ run: 900, width: 1200, riser: 150 });
  });
  it('mantiene puerta y muro independientes y rechaza opciones de porche en otro mueble', () => {
    const doc = fixture(), porch = doc.furniture[0]!;
    doc.vertices = [{ id: 'a', x: -1000, y: -150 }, { id: 'b', x: 4000, y: -150 }];
    doc.walls = [{ id: 'muro', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150,
      dimensionalOrigin: 'physical', heightMm: 2700, materials: { left: 'plaster-white', right: 'plaster-white' },
      colors: { left: '#ffffff', right: '#ffffff' } }];
    expect(collisions(doc).size).toBe(0);
    expect(() => parseEditorDocument({ ...doc, furniture: [{ ...porch, kind: 'mesa', porchSteps: true }] })).toThrow('porche');
  });
});
