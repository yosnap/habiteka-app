/** Alfombras realistas generadas con scripts/build-cc0-rugs.mjs a partir de texturas CC0. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import manifest from '../../public/models/cc0/manifest.json';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { collisions } from '@/canvas/editor-v2/spatial-placement';

interface RugAsset { file: string; kind: string; license: string; attributionRequired: boolean; sha256: string; cc0Texture?: string; sourceUrl?: string; importedAt?: string; dimensionsMm?: number[] }
interface GlbJson {
  extensionsUsed?: string[]; images?: { uri?: string; mimeType?: string; bufferView?: number }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[]; accessors?: { min?: number[]; max?: number[] }[];
  meshes?: { primitives: { attributes: { POSITION: number } }[] }[];
}
const rugs = (manifest.assets as RugAsset[]).filter((asset) => asset.kind.startsWith('alfombra_'));
const glb = (file: string) => {
  const buffer = readFileSync(`public/models/cc0/${file}`), length = buffer.readUInt32LE(12);
  return { buffer, json: JSON.parse(buffer.subarray(20, 20 + length).toString()) as GlbJson, bin: buffer.subarray(28 + length) };
};

describe('alfombras CC0', () => {
  it('hay varios diseños en 140 × 200, 160 × 230 y 200 × 300 cm, y alguna redonda', () => {
    const designs = new Set(rugs.filter((rug) => !rug.kind.includes('redonda')).map((rug) => rug.kind.replace(/_\d+x\d+$/, '')));
    expect(designs.size).toBeGreaterThanOrEqual(6);
    expect(designs.size).toBeLessThanOrEqual(10);
    for (const size of ['140x200', '160x230', '200x300']) expect(rugs.filter((rug) => rug.kind.endsWith(size)).length).toBeGreaterThanOrEqual(6);
    expect(rugs.filter((rug) => rug.kind.includes('redonda')).length).toBeGreaterThanOrEqual(1);
  });

  it('cada alfombra es CC0, declara su textura de origen y está íntegra', () => {
    for (const rug of rugs) {
      expect(rug).toMatchObject({ license: 'CC0-1.0', attributionRequired: false, file: `${rug.kind}.glb` });
      expect(rug.cc0Texture).toMatch(/^(ambientcg|polyhaven):[A-Za-z0-9_]+$/);
      expect(rug.sourceUrl).toMatch(/^https:\/\/(ambientcg\.com\/view\?id=|polyhaven\.com\/a\/)[A-Za-z0-9_]+$/);
      expect(rug.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(createHash('sha256').update(glb(rug.file).buffer).digest('hex'), rug.file).toBe(rug.sha256);
    }
  });

  it('es una losa de 10 mm apoyada en el suelo con texturas WebP de 1024 px como máximo', async () => {
    for (const rug of rugs) {
      const { buffer, json, bin } = glb(rug.file);
      expect(buffer.length, rug.file).toBeLessThan(1024 * 1024);
      expect(json.extensionsUsed).toContain('EXT_texture_webp');
      const position = json.accessors![json.meshes![0]!.primitives[0]!.attributes.POSITION]!;
      expect(position.min![1]).toBeCloseTo(0, 6);
      expect(position.max![1]).toBeCloseTo(.01, 6);
      const [width, depth, height] = rug.dimensionsMm!;
      expect(height).toBe(10);
      expect((position.max![0]! - position.min![0]!) * 1000).toBeCloseTo(width!, 0);
      expect((position.max![2]! - position.min![2]!) * 1000).toBeCloseTo(depth!, 0);
      for (const image of json.images ?? []) {
        expect(image.uri).toBeUndefined();
        const view = json.bufferViews![image.bufferView!]!, offset = view.byteOffset ?? 0;
        const meta = await sharp(bin.subarray(offset, offset + view.byteLength)).metadata();
        expect(meta.format).toBe('webp');
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1024);
      }
    }
  });

  it('aparece en Decoración con sus medidas y el nombre en español', () => {
    for (const rug of rugs) {
      const entry = getFurnitureCatalogEntry(`habiteka:asset:${rug.kind}`);
      expect(entry, rug.kind).toMatchObject({ room: 'decoracion', profile: 'rug', heightMm: 10, elevationMm: 0 });
      expect([entry!.widthMm, entry!.depthMm, entry!.heightMm]).toEqual(rug.dimensionsMm);
      expect(entry!.label).toMatch(/^(Alfombra|Kilim) .+ · (\d+ × \d+|Ø \d+) cm$/);
      expect(furnitureAsset({ catalogId: entry!.id })).toMatchObject({ url: `/models/cc0/${rug.file}`, frontRotation: 0 });
    }
    expect(searchFurnitureCatalog('alfombra yute').length).toBeGreaterThanOrEqual(4);
    expect(searchFurnitureCatalog('kilim').length).toBeGreaterThanOrEqual(3);
  });

  it('un sofá encima de una alfombra CC0 no cuenta como choque', () => {
    const piece = (id: string, catalogId: string, x: number, y: number): Furniture => {
      const entry = getFurnitureCatalogEntry(catalogId)!;
      return { id, kind: entry.kind, catalogId, x, y, widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm,
        elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: entry.color };
    };
    const doc = emptyEditorDocument();
    doc.furniture.push(piece('alfombra', 'habiteka:asset:alfombra_bereber_200x300', 1000, 1000), piece('sofa', 'habiteka:furniture:sofa-3', 1500, 1500));
    expect([...collisions(doc).keys()]).toEqual([]);
    // Control: dos sofás superpuestos sí chocan, así que la regla es la de la alfombra.
    doc.furniture.push(piece('sofa-2', 'habiteka:furniture:sofa-3', 1600, 1600));
    expect([...collisions(doc).keys()].some((key) => key.includes('sofa'))).toBe(true);
  });

  it('las alfombras del catálogo se ven con un modelo realista por defecto', () => {
    expect(furnitureModel({ catalogId: 'habiteka:furniture:alfombra' })?.key).toBe('alfombra_lana_beige_160x230');
    expect(furnitureModel({ catalogId: 'habiteka:furniture:alfombra:grande' })?.key).toBe('alfombra_yute_200x300');
    expect(furnitureModel({ catalogId: 'habiteka:asset:alfombra' })?.key).toBe('alfombra_redonda_yute_160');
  });
});
