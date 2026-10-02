import type { FurnitureCatalogEntry, FurnitureProfile } from '@/lib/editor-document/furniture-catalog';

export const CATALOG_CATEGORIES: { id: string; label: string; profiles: FurnitureProfile[]; room: FurnitureCatalogEntry['room'] }[] = [
  { id: 'seating', label: 'Sofás y sillones', room: 'salon', profiles: ['sofa', 'sofa-chaise', 'sofa-corner', 'sofa-modular', 'sofa-bed'] },
  { id: 'beds', label: 'Camas', room: 'dormitorio', profiles: ['bed'] },
  { id: 'tables', label: 'Mesas y escritorios', room: 'comedor', profiles: ['table'] },
  { id: 'chairs', label: 'Sillas y bancos', room: 'oficina', profiles: ['chair', 'bench'] },
  { id: 'storage', label: 'Almacenaje', room: 'oficina', profiles: ['cabinet', 'shelf'] },
  { id: 'kitchen', label: 'Cocina y aparatos', room: 'cocina', profiles: ['kitchen', 'appliance'] },
  { id: 'bath', label: 'Baño y lavabos', room: 'bano', profiles: ['sink', 'toilet', 'bath', 'shower'] },
  { id: 'lights', label: 'Lámparas', room: 'iluminacion', profiles: ['lamp'] },
  { id: 'decor', label: 'Plantas y decoración', room: 'decoracion', profiles: ['plant', 'decor', 'rug'] },
  { id: 'windows', label: 'Cortinas y persianas', room: 'dormitorio', profiles: ['curtain', 'curtain-open', 'roller', 'venetian', 'vertical-blind', 'shutter'] },
  { id: 'screens', label: 'TV y monitores', room: 'salon', profiles: ['screen'] },
  { id: 'outdoor', label: 'Accesorios exteriores', room: 'exterior', profiles: ['outdoor'] },
];

export function matchesCatalogCategory(item: FurnitureCatalogEntry, categoryId: string) {
  return !categoryId || Boolean(CATALOG_CATEGORIES.find(category => category.id === categoryId)?.profiles.includes(item.profile));
}
