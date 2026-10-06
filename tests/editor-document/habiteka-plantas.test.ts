/**
 * Plantas de interior de la fábrica: hojas con textura CC0 recortada por su alfa (alphaMode MASK a doble cara y WebP
 * con canal alfa), la planta genérica del catálogo se ve con una de ellas y al pintar una planta solo cambia la maceta.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HABITEKA_REGISTRY } from '@/lib/editor-document/habiteka-furniture';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { furnitureModel } from '@/lib/editor-document/furniture-models';

interface GltfJson {
  materials?: { name?: string; alphaMode?: string; alphaCutoff?: number; doubleSided?: boolean;
    pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[];
  textures?: { source?: number; extensions?: Record<string, { source?: number }> }[];
  images?: { bufferView?: number; mimeType?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
}

/** JSON y binario de un GLB (las imágenes no van comprimidas con meshopt: se leen tal cual). */
function readGlb(file: string): { json: GltfJson; bin: Buffer } {
  const glb = readFileSync(`public/models/habiteka/${file}`);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as GltfJson;
  const binStart = 20 + jsonLength;
  return { json, bin: glb.subarray(binStart + 8, binStart + 8 + glb.readUInt32LE(binStart)) };
}

function baseColorImage({ json, bin }: ReturnType<typeof readGlb>, textureIndex: number) {
  const texture = json.textures![textureIndex]!;
  const source = texture.source ?? Object.values(texture.extensions ?? {})[0]?.source;
  const image = json.images![source!]!;
  const view = json.bufferViews![image.bufferView!]!;
  return { mimeType: image.mimeType, data: bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength) };
}

const plants = HABITEKA_REGISTRY.filter((entry) => entry.family === 'plantas');

describe('familia plantas de la fábrica de muebles', () => {
  it('tiene las especies pedidas, en la decoración y con perfil de planta', () => {
    expect(plants.length).toBeGreaterThanOrEqual(15);
    for (const species of ['monstera', 'ficus_lyrata', 'olivo', 'sansevieria', 'kentia', 'potus', 'cactus', 'strelitzia', 'helecho', 'bambu']) {
      expect(plants.some((entry) => entry.id.startsWith(species)), species).toBe(true);
    }
    expect(plants.every((entry) => entry.room === 'decoracion' && entry.profile === 'plant')).toBe(true);
    // El potus colgante cuelga del techo: su cota baja es su elevación.
    expect(plants.find((entry) => entry.id.startsWith('potus_colgante'))?.elevationMm).toBeGreaterThan(900);
  });

  it('recorta las hojas por su alfa: MASK a doble cara con textura WebP que conserva el canal alfa', async () => {
    let cutouts = 0;
    for (const entry of plants) {
      const glb = readGlb(entry.file);
      for (const material of (glb.json.materials ?? []).filter((item) => item.alphaMode === 'MASK')) {
        expect(material.doubleSided, `${entry.id}: ${material.name}`).toBe(true);
        expect(material.alphaCutoff ?? .5).toBeGreaterThan(0);
        const image = baseColorImage(glb, material.pbrMetallicRoughness!.baseColorTexture!.index);
        expect(image.mimeType).toBe('image/webp');
        expect((await sharp(image.data).metadata()).hasAlpha, `${entry.id}: alfa de ${material.name}`).toBe(true);
        cutouts++;
      }
      // Ninguna hoja se mezcla por transparencia (BLEND): con recorte no hay problemas de orden de dibujo.
      expect((glb.json.materials ?? []).some((item) => item.alphaMode === 'BLEND'), entry.id).toBe(false);
    }
    expect(cutouts).toBeGreaterThanOrEqual(15);
  });

  it('la planta del catálogo se ve como el ficus lyrata y al pintarla solo cambia la maceta', () => {
    expect(furnitureModel({ catalogId: 'habiteka:furniture:planta' })).toMatchObject({ key: 'ficus_lyrata_120', url: '/models/habiteka/ficus_lyrata_120.glb' });
    for (const entry of plants) expect(furnitureAsset({ catalogId: `habiteka:model:${entry.id}` })?.tintMaterialNames).toEqual(['maceta']);
    expect(furnitureAsset({ catalogId: 'habiteka:model:cama_madera_90' })?.tintMaterialNames).toBeUndefined();
  });
});
