import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addGardenPathSegment, DEFAULT_GARDEN_PATH } from '@/lib/editor-document/garden-paths';
import { gardenPathVolumes } from '@/lib/editor-document/garden-path-volumes';
import { addMixedGarden } from '@/lib/editor-document/garden-compositions';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { hedgeModelPieces } from '@/lib/editor-document/hedge-model-pieces';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { GARDEN_MODELS } from '@/lib/editor-document/garden-models';
import { applySurfacePreset, OUTDOOR_SURFACE_PRESETS } from '@/lib/editor-document/outdoor-surface-presets';
import { addTerrainSurface, suggestedPavingSurface } from '@/lib/editor-document/terrain-surfaces';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';

it('traza un camino diagonal con plantas fuera del paso incluso después de girarlas', () => {
  const source = emptyEditorDocument();
  const doc = addGardenPathSegment(source, { x: 1000, y: 1000 }, { x: 4000, y: 5000 }, { ...DEFAULT_GARDEN_PATH, border: 'both', curb: true });
  const path = doc.furniture[0]!;
  expect(path.widthMm).toBe(5000);
  expect(localToWorld(path, { x: path.widthMm, y: path.depthMm/2 })).toEqual({ x: 4000, y: 5000 });
  for (const plant of doc.furniture.slice(1)) {
    const center = localToWorld(plant, { x: plant.widthMm/2, y: plant.depthMm/2 });
    const distance = Math.abs(-(center.x-1000)*.8+(center.y-1000)*.6);
    expect(distance).toBeCloseTo(1000);
  }
  expect(gardenPathVolumes(path).filter((p) => p.materialId === 'ambientcg:Tiles143').length).toBeGreaterThan(5);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  const store = createEditorStore(source); store.getState().apply(doc); store.getState().undo();
  expect(store.getState().document).toEqual(source);
  store.getState().redo(); expect(store.getState().document).toEqual(doc);
});

it.each([0, NaN, Infinity, 299, 10001])('rechaza ancho inválido %s antes de generar plantas', (widthMm) => {
  expect(() => addGardenPathSegment(emptyEditorDocument(), { x: 0, y: 0 }, { x: 4000, y: 0 }, { ...DEFAULT_GARDEN_PATH, widthMm })).toThrow();
});

it('conserva especie y deja libre la puerta del seto sobre un zócalo', () => {
  const doc = addLinearBoundary(emptyEditorDocument(), 'seto', { x: 0, y: 0 }, { x: 8000, y: 0 }, 'habiteka:outdoor:seto:laurel');
  const boundary = doc.boundaries![0]!;
  boundary.construction.baseHeightMm = 300;
  boundary.construction.gates = [{ id: 'gate', positionMm: 4000, widthMm: 1000, heightMm: 1800, hinge: 'left', openAngleDeg: 0, color: '#444444' }];
  const pieces = hedgeModelPieces(boundary);
  expect(pieces.length).toBeGreaterThan(5);
  for (const item of pieces) {
    expect(item.catalogId).toBe('habiteka:outdoor:seto:laurel');
    expect(item.widthMm).toBeLessThanOrEqual(1000);
    expect(item.elevationMm).toBe(300);
    expect(item.x + item.widthMm <= 3500 || item.x >= 4500).toBe(true);
  }
});

it('añade un jardín como suelo y plantas editables, reversible en un solo paso', () => {
  const source = emptyEditorDocument(), garden = addMixedGarden(source);
  expect(garden.document.terrainSurfaces).toHaveLength(1);
  expect(garden.document.furniture).toHaveLength(7);
  expect(new Set(garden.ids).size).toBe(8);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(garden.document)))).toEqual(garden.document);
  const store = createEditorStore(source); store.getState().apply(garden.document); store.getState().undo();
  expect(store.getState().document).toEqual(source);
});

it.each(OUTDOOR_SURFACE_PRESETS)('persiste la superficie $name con su textura', (preset) => {
  const doc = emptyEditorDocument();
  const surface = applySurfacePreset(suggestedPavingSurface(doc, 'patch'), preset.id);
  expect(addTerrainSurface(doc, surface).terrainSurfaces?.[0]?.texture).toBe(preset.texture);
});

it('todas las fichas de jardín y equipamiento enlazan GLB y miniatura existentes', () => {
  for (const key of Object.keys(GARDEN_MODELS)) {
    const entry = OUTDOOR_CATALOG.find((item) => item.id === `habiteka:outdoor:${key}`)!;
    expect(entry, key).toBeDefined();
    const model = furnitureModel({ catalogId: entry.id });
    expect(model, key).toBeDefined();
    expect(existsSync(`public${model!.url.split('?')[0]}`), key).toBe(true);
    expect(existsSync(`public${model!.thumbnailUrl?.split('?')[0]}`), key).toBe(true);
  }
  const variants = ['none', 'left', 'right', 'both'] as const;
  const urls = variants.map((rolledSides) => furnitureModel({ catalogId: 'habiteka:outdoor:carpa', rolledSides })!.url);
  expect(new Set(urls).size).toBe(4);
  urls.forEach((url) => expect(existsSync(`public${url}`)).toBe(true));
});

it('cada material de camino existe en la biblioteca local', () => {
  for (const entry of OUTDOOR_CATALOG.filter((item) => item.kind === 'camino')) {
    const item = { ...entry, id: 'path', catalogId: entry.id, x: 0, y: 0, rotation: 0, dimensionalOrigin: 'physical' as const };
    for (const part of gardenPathVolumes(item)) expect(surfaceMaterial(part.materialId!), part.materialId).toBeDefined();
  }
});
