import type { CatalogPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';

/**
 * Fotos de producto de las fichas de Construir, renderizadas con Blender por scripts/build-construction-photos.mjs en
 * public/images/construction/<id>.webp (336 × 224 px). Cada identificador es una escena de
 * scripts/blender/construction_photos.py.
 */
export const CONSTRUCTION_PHOTO_IDS = [
  'pared', 'murete', 'habitacion', 'habitacion-l', 'habitacion-u', 'habitacion-t', 'cocina', 'forma-l', 'forma-u',
  'forma-t', 'escalera-recta', 'escalera-l', 'escalera-u', 'descansillo', 'rampa', 'columna', 'paso-abierto', 'patio',
  'pavimento', 'terreno',
] as const;
export type ConstructionPhotoId = (typeof CONSTRUCTION_PHOTO_IDS)[number];

export function constructionPhotoUrl(id: ConstructionPhotoId): string {
  return `/images/construction/${id}.webp`;
}

/** Foto estática de la ficha; no tiene render alternativo en el navegador: si no carga, queda el marcador neutro. */
export function constructionPhotoSource(id: ConstructionPhotoId): CatalogPhotoSource {
  const url = constructionPhotoUrl(id);
  return { kind: 'image', key: url, url, render: null };
}
