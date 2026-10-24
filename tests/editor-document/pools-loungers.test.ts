import { expect, it } from 'vitest';
import { createGltfIO, measureDocument } from '../../scripts/lib/glb-optimize.mjs';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { constructionGroup } from '@/lib/editor-document/element-classification';
import { listedForProposal } from '@/lib/editor-document/habiteka-furniture';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { catalogEntryFurniture } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setLoungerBackrest } from '@/lib/editor-document/lounger-backrest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

it.each(['teca', 'aluminio'])('levanta y baja el respaldo de %s conservando ubicación, escala y deshacer', material => {
  const entry = getFurnitureCatalogEntry(`habiteka:model:tumbona_${material}_tumbada`)!;
  const item = { ...catalogEntryFurniture(entry), x: 8000, y: 9000, rotation: 35,
    heightMm: entry.heightMm * 1.2, elevationMm: 250, name: 'Mi tumbona' };
  const doc = { ...upgradeSpatialDocument(emptyEditorDocument()), furniture: [item] };
  const store = createEditorStore(doc);
  const raised = setLoungerBackrest(doc, item.id, true);
  expect(raised.furniture[0]).toMatchObject({ id: item.id, x: 8000, y: 9000, rotation: 35, elevationMm: 250, name: 'Mi tumbona' });
  expect(raised.furniture[0]!.heightMm).toBeGreaterThan(item.heightMm);
  store.getState().apply(raised);
  store.getState().undo(); expect(store.getState().document).toEqual(doc);
  store.getState().redo(); expect(store.getState().document).toEqual(raised);
  const flat = setLoungerBackrest(raised, item.id, false).furniture[0]!;
  expect(flat.catalogId).toBe(item.catalogId);
  expect(flat.heightMm).toBeCloseTo(item.heightMm);
});

it('todas las piscinas se encuentran en Construir y no se proponen como mobiliario', () => {
  const pools = FURNITURE_CATALOG.filter(e => /piscina/.test(e.id));
  expect(pools).toHaveLength(4);
  for (const entry of pools) {
    expect(constructionGroup(entry)).toBe('Agua y drenaje');
    expect(listedForProposal(entry)).toBe(false);
    expect(furnitureModel(catalogEntryFurniture(entry))).toBeDefined();
  }
});

it('las tumbonas permanecen en Amueblar con acabados y respaldo tumbado', () => {
  const entries = searchFurnitureCatalog('tumbona', 'exterior');
  expect(entries).toHaveLength(4);
  expect(entries.every(e => constructionGroup(e) === undefined)).toBe(true);
  const flat = getFurnitureCatalogEntry('habiteka:model:tumbona_aluminio_tumbada')!;
  const inclined = getFurnitureCatalogEntry('habiteka:model:tumbona_aluminio')!;
  expect(flat.heightMm).toBeLessThan(inclined.heightMm - 200);
  expect(flat.widthMm).toBe(inclined.widthMm);
  expect(flat.productId).toBe(inclined.productId);
});

it('mejora el vaso elevado sin cambiar la identidad o las medidas iniciales del plano', async () => {
  const entry = OUTDOOR_CATALOG.find(e => e.kind === 'piscina')!;
  expect([entry.widthMm, entry.depthMm, entry.heightMm]).toEqual([6000, 3000, 1200]);
  const asset = furnitureModel(catalogEntryFurniture(entry))!;
  expect(asset.key).toBe('piscina_elevada_exterior');
  expect(asset.url).toContain(`?v=${asset.sha256.slice(0, 12)}`);
  expect(asset.thumbnailUrl).toContain(`?v=${asset.sha256.slice(0, 12)}`);
  const io = await createGltfIO(), document = await io.read(`public${asset.url.split('?')[0]}`);
  const water = document.getRoot().listMaterials().find(m => m.getName() === 'agua')!;
  expect(water.getAlphaMode()).toBe('OPAQUE');
  expect(document.getRoot().listMaterials().map(m => m.getName())).toEqual(expect.arrayContaining(['madera', 'liner', 'inox', 'piedra']));
  expect(measureDocument(document)[2]).toBeGreaterThan(1400);
});
