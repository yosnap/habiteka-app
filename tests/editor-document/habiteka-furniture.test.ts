import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Document } from '@gltf-transform/core';
import {
  catalogEntryFromRegistry, HABITEKA_FURNITURE_CATALOG, HABITEKA_MODEL_LICENSE, HABITEKA_REGISTRY, HABITEKA_SMALLER, listedForProposal,
} from '@/lib/editor-document/habiteka-furniture';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { measureElevation } from '../../scripts/lib/glb-optimize.mjs';
import { furnitureAsset, REALISTIC_ASSET_REPLACEMENTS } from '@/lib/editor-document/furniture-assets';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel } from '@/lib/editor-document/furniture-models';

const DIR = 'public/models/habiteka';
const manifests = Object.fromEntries(readdirSync(`${DIR}/manifest`).filter((file) => file.endsWith('.json'))
  .map((file) => [file.slice(0, -5), JSON.parse(readFileSync(`${DIR}/manifest/${file}`, 'utf8'))]));

describe('muebles propios de la fábrica de Blender', () => {
  it('tiene un registro coherente: ids únicos, archivos íntegros, miniaturas y medidas positivas', () => {
    expect(HABITEKA_REGISTRY.length).toBeGreaterThan(100);
    expect(new Set(HABITEKA_REGISTRY.map((entry) => entry.id)).size).toBe(HABITEKA_REGISTRY.length);
    for (const entry of HABITEKA_REGISTRY) {
      const glb = readFileSync(`${DIR}/${entry.file}`);
      expect(createHash('sha256').update(glb).digest('hex')).toBe(entry.sha256);
      expect(glb.readUInt32LE(0)).toBe(0x46546c67);
      expect(glb.length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      const thumb = readFileSync(`${DIR}/${entry.thumbnail}`);
      expect(thumb.subarray(8, 12).toString()).toBe('WEBP');
      const maximum = entry.room === 'exterior' ? 20000 : 4000;
      expect([entry.widthMm, entry.depthMm, entry.heightMm].every((size) => size > 0 && size <= maximum), entry.id).toBe(true);
    }
  });

  it('registra la procedencia: autor propio, versión, parámetros y fuente CC0 de cada textura', () => {
    for (const entry of HABITEKA_REGISTRY) {
      const manifest = manifests[entry.family];
      const model = manifest?.models[entry.id];
      expect(model, entry.id).toMatchObject({ author: 'Habiteka (modelo propio)', license: HABITEKA_MODEL_LICENSE, sha256: entry.sha256 });
      expect(model.generatorVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(model.params).toBeTypeOf('object');
      expect(model.triangles).toBeLessThanOrEqual(40_000);
      for (const key of model.textures) {
        const texture = manifest.textures[key];
        expect(texture, `${entry.id}: ${key}`).toMatchObject({ license: 'CC0-1.0' });
        expect(['polyhaven', 'ambientcg']).toContain(texture.source);
        expect(texture.pageUrl).toMatch(/^https:\/\/(polyhaven\.com|ambientcg\.com)\//);
        expect(texture.downloads.length).toBeGreaterThan(0);
      }
    }
  });

  it('aparece en el catálogo con sus variantes agrupadas y su modelo con foto de producto', () => {
    for (const entry of HABITEKA_FURNITURE_CATALOG) {
      expect(FURNITURE_CATALOG).toContainEqual(entry);
      expect(getFurnitureCatalogEntry(entry.id)).toEqual(entry);
      const asset = furnitureAsset({ catalogId: entry.id })!;
      expect(asset).toMatchObject({ frontRotation: 0, attributionRequired: false });
      expect(existsSync(`public${asset.url}`) && existsSync(`public${asset.thumbnailUrl}`)).toBe(true);
    }
    const products = new Map<string, number>();
    for (const entry of HABITEKA_FURNITURE_CATALOG) products.set(entry.productId, (products.get(entry.productId) ?? 0) + 1);
    expect([...products.values()].some((count) => count >= 6)).toBe(true);
    const beds = HABITEKA_FURNITURE_CATALOG.filter((entry) => entry.productId === 'habiteka-cama_tapizada');
    expect(new Set(beds.map((entry) => entry.label)).size).toBe(1);
    expect(beds.map((entry) => entry.variantLabel)).toEqual(expect.arrayContaining([expect.stringContaining('90 × 190'), expect.stringContaining('180 × 200')]));
    expect(searchFurnitureCatalog('chaise').some((entry) => entry.id.startsWith('habiteka:model:'))).toBe(true);
    expect(searchFurnitureCatalog('taburete', 'cocina').some((entry) => entry.id.startsWith('habiteka:model:'))).toBe(true);
  });

  it('ofrece a Amueblar una variante por producto y la medida menor del mismo modelo', () => {
    const listed = HABITEKA_FURNITURE_CATALOG.filter(listedForProposal);
    expect(listed.length).toBe(new Set(HABITEKA_FURNITURE_CATALOG.map((entry) => entry.productId)).size);
    for (const [from, to] of Object.entries(HABITEKA_SMALLER)) {
      const a = getFurnitureCatalogEntry(from)!, b = getFurnitureCatalogEntry(to)!;
      expect(b.productId).toBe(a.productId);
      expect(b.widthMm).toBeLessThan(a.widthMm);
      expect([b.material, b.color]).toEqual([a.material, a.color]);
    }
    expect(HABITEKA_SMALLER['habiteka:model:cama_tapizada_180']).toBe('habiteka:model:cama_tapizada_160');
    expect(HABITEKA_SMALLER['habiteka:model:sofa_chaise_izquierda_4p']).toBe('habiteka:model:sofa_chaise_izquierda_3p');
    expect(listedForProposal({ id: 'habiteka:furniture:sofa-3' })).toBe(true);
  });

  it('oculta los modelos antiguos duplicados sin romper los documentos que los usan', () => {
    for (const key of Object.keys(REALISTIC_ASSET_REPLACEMENTS)) {
      const id = `habiteka:asset:${key}`;
      expect(FURNITURE_CATALOG.some((entry) => entry.id === id)).toBe(false);
      expect(getFurnitureCatalogEntry(id)).toBeDefined();
      // El sustituto es la clave de un modelo CC0 o el id de un mueble propio (habiteka:model:<pieza>).
      expect(furnitureModel({ catalogId: id })?.key).toBe(REALISTIC_ASSET_REPLACEMENTS[key]!.split(':').pop());
    }
    expect(FURNITURE_CATALOG.some((entry) => entry.label.includes('modelo 3D'))).toBe(false);
    expect(furnitureModel({ catalogId: 'habiteka:furniture:sofa-3' })?.url).toBe('/models/habiteka/sofa_moderno_3p.glb');
  });

  it('coloca a su altura real las piezas colgadas: la elevación sale de la geometría y dims es lo visible', () => {
    const document = new Document(), buffer = document.createBuffer();
    // Mueble de lavabo suspendido: base a 350 mm del suelo y 550 mm de alto visible.
    const position = document.createAccessor().setType('VEC3').setBuffer(buffer)
      .setArray(new Float32Array([-.4, .35, -.23, .4, .35, -.23, .4, .9, .23, -.4, .9, .23]));
    const mesh = document.createMesh().addPrimitive(document.createPrimitive().setAttribute('POSITION', position));
    document.createScene().addChild(document.createNode().setMesh(mesh));
    expect(measureElevation(document)).toBe(350);
    const entry = { ...HABITEKA_REGISTRY[0]!, id: 'mueble_lavabo_suspendido_80', widthMm: 800, depthMm: 460, heightMm: 550, elevationMm: 350 };
    const catalog = catalogEntryFromRegistry(entry);
    expect(catalog).toMatchObject({ elevationMm: 350, heightMm: 550 });
    const item = addFurniture(emptyEditorDocument(), catalog, { x: 0, y: 0 }).furniture[0]!;
    expect(furnitureSpatial(item)).toMatchObject({ elevationMm: 350, heightMm: 550 });
    expect(catalogEntryFromRegistry({ ...entry, elevationMm: undefined }).elevationMm).toBe(0);
    expect(HABITEKA_FURNITURE_CATALOG.filter((item) => item.profile === 'bed').every((item) => item.elevationMm === 0)).toBe(true);
  });
});
