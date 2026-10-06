import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import manifest from '../../public/models/cc0/manifest.json';
import { ASSET_CATALOG, furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

interface ManifestAsset {
  file: string; kind: string; source: string; author: string; license: string; attributionRequired: boolean; sha256: string;
  polyhavenId?: string; title?: string; sourceUrl?: string; importedAt?: string; dimensionsMm?: number[];
}
const assets = manifest.assets as ManifestAsset[];
const polyhaven = assets.filter((asset) => asset.polyhavenId);
const glbJson = (buffer: Buffer) => JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString()) as {
  extensionsUsed?: string[]; images?: { uri?: string; mimeType?: string; bufferView?: number }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
};
/** El chunk BIN empieza tras el JSON alineado: 12 bytes de cabecera, 8 de cada chunk. */
const binChunk = (buffer: Buffer) => buffer.subarray(28 + buffer.readUInt32LE(12));
const ids = (query: string) => searchFurnitureCatalog(query).map((entry) => entry.id);

describe('modelos CC0 de Poly Haven', () => {
  it('cada modelo del manifiesto existe, está íntegro y declara una licencia conocida', () => {
    expect(new Set(assets.map((asset) => asset.kind)).size).toBe(assets.length);
    expect(new Set(assets.map((asset) => asset.file)).size).toBe(assets.length);
    for (const asset of assets) {
      const path = `public/models/cc0/${asset.file}`;
      expect(existsSync(path), path).toBe(true);
      expect(createHash('sha256').update(readFileSync(path)).digest('hex'), path).toBe(asset.sha256);
      expect(['CC0-1.0', 'CC-BY-4.0']).toContain(asset.license);
      expect(asset.attributionRequired).toBe(asset.license !== 'CC0-1.0');
    }
  });

  it('registra la procedencia completa de cada importación, solo CC0', () => {
    expect(polyhaven.length).toBeGreaterThanOrEqual(30);
    for (const asset of polyhaven) {
      expect(asset).toMatchObject({ license: 'CC0-1.0', attributionRequired: false,
        sourceUrl: `https://polyhaven.com/a/${asset.polyhavenId}`, file: `${asset.polyhavenId!.toLowerCase()}.glb` });
      expect(asset.source).toContain(`polyhaven.com/a/${asset.polyhavenId}`);
      expect(asset.title?.length).toBeGreaterThan(0);
      expect(asset.author.length).toBeGreaterThan(0);
      expect(asset.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(asset.dimensionsMm).toHaveLength(3);
      for (const value of asset.dimensionsMm!) expect(Number.isInteger(value) && value > 0).toBe(true);
    }
  });

  it('da de alta cada importación con sus medidas reales y sin giro adicional', () => {
    for (const asset of polyhaven) {
      const entry = getFurnitureCatalogEntry(`habiteka:asset:${asset.kind}`);
      expect(entry, asset.kind).toBeDefined();
      expect([entry!.widthMm, entry!.depthMm, entry!.heightMm]).toEqual(asset.dimensionsMm);
      expect(entry!.label).not.toContain('_');
      expect(entry!.label).not.toBe(asset.title);
      expect(furnitureAsset({ catalogId: entry!.id })).toMatchObject({ url: `/models/cc0/${asset.file}`, frontRotation: 0 });
    }
  });

  it('pesa poco: un GLB autocontenido con meshopt y texturas WebP de 1K como máximo', async () => {
    let total = 0;
    for (const asset of polyhaven) {
      const buffer = readFileSync(`public/models/cc0/${asset.file}`), json = glbJson(buffer), bin = binChunk(buffer);
      total += statSync(`public/models/cc0/${asset.file}`).size;
      expect(buffer.length, asset.file).toBeLessThan(2 * 1024 * 1024);
      expect(json.extensionsUsed).toEqual(expect.arrayContaining(['EXT_meshopt_compression']));
      for (const image of json.images ?? []) {
        expect(image.uri).toBeUndefined();
        expect(image.mimeType).toBe('image/webp');
        const view = json.bufferViews![image.bufferView!]!, offset = view.byteOffset ?? 0;
        const { width = 0, height = 0 } = await sharp(bin.subarray(offset, offset + view.byteLength)).metadata();
        expect(Math.max(width, height), asset.file).toBeLessThanOrEqual(1024);
      }
    }
    expect(total).toBeLessThan(50 * 1024 * 1024);
  });

  it('el catálogo encuentra las piezas nuevas por su nombre en español', () => {
    expect(ids('taburete')).toEqual(expect.arrayContaining(['habiteka:asset:taburete_barra_madera',
      'habiteka:asset:taburete_barra_metal', 'habiteka:asset:taburete_barra_respaldo']));
    expect(ids('lámpara')).toEqual(expect.arrayContaining(['habiteka:asset:lampara_mesa_industrial', 'habiteka:asset:flexo_articulado']));
    expect(ids('mesilla')).toEqual(expect.arrayContaining(['habiteka:asset:mesilla_madera_cajon', 'habiteka:asset:mesilla_estantes']));
    expect(ids('comoda')).toContain('habiteka:asset:comoda_clasica');
    expect(ids('aparador')).toContain('habiteka:asset:aparador_bajo_moderno');
    expect(ids('sofa piel')).toContain('habiteka:asset:sofa_chester_piel');
    expect(ids('cama')).toEqual(expect.arrayContaining(['habiteka:asset:cama_doble_tallada', 'habiteka:asset:cama_individual_hierro']));
    expect(ids('estanteria')).toContain('habiteka:asset:estanteria_cubos');
    expect(ids('horno')).toContain('habiteka:asset:cocina_electrica_horno');
  });

  it('coloca el flexo a la altura de un escritorio y el resto de piezas en el suelo', () => {
    const flexo = getFurnitureCatalogEntry('habiteka:asset:flexo_articulado')!;
    expect(addFurniture(emptyEditorDocument(), flexo, { x: 0, y: 0 }).furniture[0]).toMatchObject({ elevationMm: 750, heightMm: 893 });
    const grounded = ASSET_CATALOG.filter((entry) => entry.id !== flexo.id);
    expect(grounded.every((entry) => entry.elevationMm === 0)).toBe(true);
  });
});
