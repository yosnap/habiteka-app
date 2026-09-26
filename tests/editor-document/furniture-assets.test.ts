import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ASSET_CATALOG, furnitureAsset, ORIGINAL_ASSET_COLOR } from '@/lib/editor-document/furniture-assets';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { furnitureDesignContext } from '@/lib/editor-document/furniture-context';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';
import { CATALOG_BY_KIND } from '@/canvas/catalog';

describe('audited local furniture assets', () => {
  it('registers 36 distinct local assets with intact GLB binaries', () => {
    expect(ASSET_CATALOG).toHaveLength(36);
    expect(new Set(FURNITURE_CATALOG.map((item) => item.id)).size).toBe(FURNITURE_CATALOG.length);
    for (const entry of ASSET_CATALOG) {
      const asset = furnitureAsset({ catalogId: entry.id })!;
      const buffer = readFileSync(`public${asset.url}`);
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(asset.sha256);
      expect(buffer.readUInt32LE(0)).toBe(0x46546c67); expect(buffer.readUInt32LE(4)).toBe(2);
      expect(buffer.readUInt32LE(8)).toBe(buffer.length);
      const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
      expect(json.meshes.length).toBeGreaterThan(0);
      expect(getFurnitureCatalogEntry(entry.id)).toEqual(entry);
      for (const resource of [...(json.images ?? []), ...(json.buffers ?? [])]) expect(resource.uri).toBeUndefined();
    }
  });
  it('never resolves arbitrary URLs or changes historical builtin identities', () => {
    expect(furnitureAsset({ catalogId: 'https://example.com/private.glb' })).toBeUndefined();
    expect(furnitureAsset({ catalogId: 'builtin:sofa' })).toBeUndefined();
    const before = emptyEditorDocument(), next = addFurniture(before, CATALOG_BY_KIND.sofa!, { x: 0, y: 0 });
    expect(next.schemaVersion).toBe(2); expect(next.furniture[0]!.catalogId).toBe('builtin:sofa');
    expect(before.furniture).toHaveLength(0);
  });
  it('names previously approximate files by their real content', () => {
    expect(getFurnitureCatalogEntry('habiteka:asset:bidet')!.label).toBe('Contenedor de baño');
    expect(getFurnitureCatalogEntry('habiteka:asset:isla')!.label).toContain('Mesa');
    expect(getFurnitureCatalogEntry('habiteka:asset:vitroceramica')!.label).toContain('fogones');
    expect(getFurnitureCatalogEntry('habiteka:asset:mesa')!.label).toContain('redonda');
    expect(searchFurnitureCatalog('sofa').length).toBeGreaterThan(3);
    expect(searchFurnitureCatalog('imposiblexyz')).toHaveLength(0);
  });
  it('preserves catalog, dimensions and appearance through history and roundtrip', () => {
    const before = emptyEditorDocument(), entry = ASSET_CATALOG[0]!;
    const next = addFurniture(before, entry, { x: 123, y: 456 }), store = createEditorStore(before);
    store.getState().apply(next);
    const parsed = parseEditorDocument(JSON.parse(JSON.stringify(next))), item = parsed.furniture[0]!;
    expect(item).toMatchObject({ catalogId: entry.id, widthMm: entry.widthMm, heightMm: entry.heightMm, color: ORIGINAL_ASSET_COLOR });
    const volumes = furnitureVolumes(item);
    expect(volumes).toHaveLength(1); expect(volumes[0]).toMatchObject({ widthMm: item.widthMm, depthMm: item.depthMm, bottom: 0, top: item.heightMm });
    store.getState().undo(); expect(store.getState().document).toEqual(before);
    store.getState().redo(); expect(store.getState().document).toEqual(next);
  });
  it('describes real materials and separate floors without mutating the document', () => {
    const source = addFurniture(emptyEditorDocument(), ASSET_CATALOG[1]!, { x: 0, y: 0 });
    const doc = addBuildingLevel(source, true), saved = JSON.stringify(doc), context = furnitureDesignContext(doc);
    expect(context.levels).toHaveLength(2);
    expect(context.levels[0]!.furniture[0]!.color).toBeNull();
    expect(context.levels[0]!.furniture[0]!.appearance).toMatchObject({ license: 'CC-BY-4.0', finish: 'original-model-materials' });
    expect(context.levels[1]!.elevationMm).toBeGreaterThan(0);
    expect(JSON.stringify(doc)).toBe(saved);
  });
});
