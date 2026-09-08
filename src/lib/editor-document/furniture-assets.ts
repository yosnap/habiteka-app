import manifest from '../../../public/models/cc0/manifest.json';
import type { Furniture } from './schema';
import type { FurnitureCatalogEntry, FurnitureProfile, FurnitureRoom } from './furniture-catalog';

export const ORIGINAL_ASSET_COLOR = '#8ea69b';
type AssetDefinition = [string, string, FurnitureRoom, FurnitureProfile, number, number, number];
/** Filenames are historical. Labels describe the actual model, not old placeholder aliases. */
const definitions: AssetDefinition[] = [
  ['silla', 'Silla Sheen', 'comedor', 'chair', 600, 600, 850],
  ['sofa', 'Sofá Glam Velvet', 'salon', 'sofa', 2000, 900, 850],
  ['cama', 'Cama doble · modelo 3D', 'dormitorio', 'bed', 1500, 2000, 800],
  ['armario', 'Armario · modelo 3D', 'dormitorio', 'cabinet', 1200, 600, 2000],
  ['mesa', 'Mesa redonda pequeña', 'comedor', 'table', 800, 800, 750],
  ['nevera', 'Frigorífico · modelo 3D', 'cocina', 'appliance', 700, 700, 1800],
  ['horno', 'Horno · modelo 3D', 'cocina', 'appliance', 600, 600, 900],
  ['fregadero', 'Fregadero · modelo 3D', 'cocina', 'sink', 800, 600, 900],
  ['inodoro', 'Inodoro · modelo 3D', 'bano', 'toilet', 400, 700, 800],
  ['lavabo', 'Lavabo · modelo 3D', 'bano', 'sink', 600, 450, 850],
  ['ducha', 'Cabina de ducha curva', 'bano', 'shower', 900, 900, 2000],
  ['tv', 'Pantalla de televisión', 'salon', 'screen', 1200, 100, 700],
  ['planta', 'Planta con maceta · modelo 3D', 'decoracion', 'plant', 450, 450, 1000],
  ['microondas', 'Microondas · modelo 3D', 'cocina', 'appliance', 550, 380, 350],
  ['banera', 'Bañera · modelo 3D', 'bano', 'bath', 1700, 750, 600],
  ['mesilla', 'Mesita de noche · modelo 3D', 'dormitorio', 'cabinet', 450, 400, 500],
  ['vitroceramica', 'Cocina con fogones', 'cocina', 'appliance', 600, 600, 900],
  ['encimera', 'Mueble bajo de cocina · modelo 3D', 'cocina', 'kitchen', 1200, 600, 900],
  ['estanteria', 'Estantería con libros', 'salon', 'shelf', 1000, 300, 1800],
  ['lampara', 'Lámpara de pie · modelo 3D', 'iluminacion', 'lamp', 400, 400, 1500],
  ['chimenea', 'Chimenea · modelo 3D', 'salon', 'cabinet', 1200, 400, 1200],
  ['ordenador', 'Ordenador portátil', 'oficina', 'screen', 350, 250, 250],
  ['alfombra', 'Alfombra redonda', 'decoracion', 'rug', 1600, 1600, 10],
  ['isla', 'Mesa con base en cruz', 'comedor', 'table', 1000, 1000, 750],
  ['bidet', 'Contenedor de baño', 'bano', 'cabinet', 350, 350, 500],
  ['nevera_americana', 'Frigorífico grande · modelo 3D', 'cocina', 'appliance', 900, 800, 1800],
  ['nevera_mini', 'Minifrigorífico · modelo 3D', 'cocina', 'appliance', 500, 550, 850],
  ['sofa_grande', 'Sofá grande · modelo 3D', 'salon', 'sofa', 2800, 1000, 850],
  ['butaca', 'Butaca · modelo 3D', 'salon', 'sofa', 900, 900, 850],
];
export const ASSET_CATALOG: FurnitureCatalogEntry[] = definitions.map(([key, label, room, profile, widthMm, depthMm, heightMm]) => ({
  id: `habiteka:asset:${key}`, productId: `asset-${key}`, variantLabel: 'Original', kind: `asset-${key}`,
  label, room, category: profile, profile, function: label, style: 'Modelo original', material: 'Materiales del modelo',
  color: ORIGINAL_ASSET_COLOR, widthMm, depthMm, heightMm, elevationMm: 0,
}));
const assets = new Map(definitions.map(([key]) => {
  const provenance = manifest.assets.find((item) => item.kind === key)!;
  if (!provenance) throw new Error(`Falta procedencia del modelo ${key}`);
  return [`habiteka:asset:${key}` as string, { key, url: `/models/cc0/${provenance.file}`, ...provenance,
    // Fixed facing direction: resizing never changes orientation automatically.
    frontRotation: key === 'cama' ? Math.PI : key === 'armario' ? -Math.PI / 2 : 0,
  }] as const;
}));
export function furnitureAsset(item: Pick<Furniture, 'catalogId'>) {
  return item.catalogId ? assets.get(item.catalogId) : undefined;
}
