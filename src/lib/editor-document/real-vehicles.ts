import manifest from '../../../public/models/vehicles/manifest.json';
import type { FurnitureCatalogEntry } from './furniture-catalog';

/** Los nombres comerciales corresponden a los modelos importados, nunca a carrocerías procedurales. */
export const REAL_VEHICLE_CATALOG: FurnitureCatalogEntry[] = manifest.map((model) => ({
  id: `habiteka:vehicle:${model.id}`, productId: model.id, variantLabel: 'Modelo original', kind: model.id,
  label: model.label, room: 'exterior', category: 'decor', profile: 'decor', function: 'Vehículo para aparcamiento',
  style: 'Modelo real', material: 'Carrocería, vidrio y neumáticos originales', color: '#8ea69b',
  widthMm: model.dimensionsMm[0]!, depthMm: model.dimensionsMm[1]!, heightMm: model.dimensionsMm[2]!, elevationMm: 0,
}));

export const REAL_VEHICLE_ASSETS = manifest.map((model) => [`habiteka:vehicle:${model.id}`, {
  key: model.id, kind: model.id, file: model.file, frontRotation: 0,
  url: `/models/vehicles/${model.file}?v=${model.sha256.slice(0, 12)}`,
  thumbnailUrl: `/models/vehicles/${model.thumbnail}?v=${model.sha256.slice(0, 12)}`,
  source: model.source, sourceUrl: model.source, author: model.author, license: model.license,
  licenseUrl: model.licenseUrl, attributionRequired: true, sha256: model.sha256,
  modifications: model.modifications, tintMaterialNames: model.paintMaterialNames,
}] as const);

/** Conserva la resolución de documentos antiguos, pero no permite añadir más vehículos inventados. */
export function isLegacyVehicle(entry: Pick<FurnitureCatalogEntry, 'id'>): boolean {
  return entry.id.startsWith('habiteka:outdoor:coche') ||
    /^habiteka:model:(turismo_|vehiculo_|furgoneta_|coche_|moto_|scooter_|bicicleta_)/.test(entry.id);
}
