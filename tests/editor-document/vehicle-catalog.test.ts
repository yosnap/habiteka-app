import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { HABITEKA_REGISTRY } from '@/lib/editor-document/habiteka-furniture';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { catalogEntryFurniture, furniturePhotoSource, renderedFurnitureSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';

it.each(['coche', 'coche:turismo-3d', 'coche:suv', 'coche:furgoneta'])('actualiza foto, plano y modelo de %s manteniendo medidas guardadas', (key) => {
  const entry = OUTDOOR_CATALOG.find((entry) => entry.id === `habiteka:outdoor:${key}`)!;
  const item = catalogEntryFurniture(entry), asset = furnitureModel(item)!;
  const version = HABITEKA_REGISTRY.find((entry) => entry.id === asset.key)!.sha256.slice(0, 12);
  expect(asset.url).toContain(`?v=${version}`);
  expect(asset.thumbnailUrl).toContain(`?v=${version}`);
  expect(furniturePhotoSource(item)).toMatchObject({ kind: 'image', url: asset.thumbnailUrl });
  expect(renderedFurnitureSource(item)?.key).toContain(asset.url);
  const glb = readFileSync(`public${asset.url.split('?')[0]}`);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  expect(json.materials.map((material: { name: string }) => material.name)).toEqual(expect.arrayContaining(['pintura', 'vidrio', 'goma', 'inox', 'freno', 'faro', 'piloto']));
  const saved = addFurniture(emptyEditorDocument(), entry, { x: 0, y: 0 });
  Object.assign(saved.furniture[0]!, { widthMm: 2300, depthMm: 5300, heightMm: 1900, color: '#cc5544' });
  expect(parseEditorDocument(JSON.parse(JSON.stringify(saved))).furniture[0]).toMatchObject({ widthMm: 2300, depthMm: 5300, heightMm: 1900, color: '#cc5544' });
});
