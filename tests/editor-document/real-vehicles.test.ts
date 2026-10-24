import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import manifest from '../../public/models/vehicles/manifest.json';
import { REAL_VEHICLE_CATALOG, isLegacyVehicle } from '@/lib/editor-document/real-vehicles';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { furnitureRooms } from '@/lib/editor-document/furniture-rooms';
import { createGltfIO, measureDocument, triangleCount } from '../../scripts/lib/glb-optimize.mjs';

describe('vehículos de marcas y modelos reales', () => {
  it('ofrece Tesla y Ford con la identidad de sus assets, sin vehículos inventados', () => {
    expect(searchFurnitureCatalog('Tesla Model 3')).toHaveLength(1);
    expect(searchFurnitureCatalog('Ford Mustang')).toHaveLength(1);
    expect(FURNITURE_CATALOG.some(isLegacyVehicle)).toBe(false);
    for (const entry of REAL_VEHICLE_CATALOG) {
      expect(furnitureRooms(entry)).toEqual(expect.arrayContaining(['garaje', 'exterior']));
      expect(getFurnitureCatalogEntry(entry.id)).toEqual(entry);
    }
    // No se borra ni se cambia por otra marca la identidad de los documentos anteriores.
    const legacy = getFurnitureCatalogEntry('habiteka:outdoor:coche')!;
    expect(legacy).toBeDefined();
    expect(furnitureModel({ catalogId: legacy.id })?.key).toBe('turismo_compacto_exterior');
  });

  it('verifica el binario, sus medidas y los créditos conservados en el GLB', async () => {
    const io = await createGltfIO();
    for (const model of manifest) {
      const asset = furnitureModel({ catalogId: `habiteka:vehicle:${model.id}` })!;
      expect(asset).toMatchObject({ author: model.author, license: 'CC BY 4.0', attributionRequired: true,
        sourceUrl: model.source, licenseUrl: model.licenseUrl, tintMaterialNames: model.paintMaterialNames });
      expect(model.paintMaterialNames.length).toBeGreaterThan(0);
      const file = `public${asset.url.split('?')[0]}`;
      const binary = readFileSync(file);
      expect(createHash('sha256').update(binary).digest('hex')).toBe(model.sha256);
      expect(binary.length).toBeLessThan(2 * 1024 * 1024);
      expect(existsSync(`public${asset.thumbnailUrl!.split('?')[0]}`)).toBe(true);
      const document = await io.read(file);
      expect(measureDocument(document)).toEqual(model.dimensionsMm);
      expect(triangleCount(document)).toBeLessThan(105000);
      expect(document.getRoot().listMaterials().every(m => !m.getDoubleSided())).toBe(true);
      expect(document.getRoot().getExtras()).toMatchObject({ license: 'CC BY 4.0', source: model.source });
    }
  });
});
