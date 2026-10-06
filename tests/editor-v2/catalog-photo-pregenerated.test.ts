import { describe, expect, it, vi } from 'vitest';

// El registro de modelos lo mantiene otro equipo; aquí se simula un modelo que ya declara su miniatura.
vi.mock('@/lib/editor-document/furniture-models', async (original) => {
  const actual = await original<typeof import('@/lib/editor-document/furniture-models')>();
  return { ...actual, furnitureModel: (item: Parameters<typeof actual.furnitureModel>[0]) => {
    const model = actual.furnitureModel(item);
    return model && item.catalogId === 'habiteka:furniture:sofa-3' ? { ...model, thumbnailUrl: '/models/habiteka/thumbs/sofa-3.webp' } : model;
  } };
});

const { catalogEntryFurniture, furniturePhotoSource, renderedFurnitureSource } = await import('@/canvas/editor-v2/scene/catalog-photo-subjects');
const { FURNITURE_CATALOG } = await import('@/lib/editor-document/furniture-catalog');

describe('foto de catálogo con miniatura pregenerada', () => {
  it('usa la imagen pregenerada y conserva el render del modelo como respaldo', () => {
    const item = catalogEntryFurniture(FURNITURE_CATALOG.find((entry) => entry.id === 'habiteka:furniture:sofa-3')!);
    const source = furniturePhotoSource(item)!;
    expect(source).toMatchObject({ kind: 'image', url: '/models/habiteka/thumbs/sofa-3.webp' });
    if (source.kind !== 'image') return;
    expect(source.render).toEqual(renderedFurnitureSource(item));
    expect(source.render?.kind).toBe('model');
  });

  it('sin miniatura, la tarjeta se renderiza en el navegador', () => {
    // El horno de pie no tiene modelo 3D (el lavavajillas ya se ve con el de la fábrica).
    const item = catalogEntryFurniture(FURNITURE_CATALOG.find((entry) => entry.id === 'habiteka:furniture:horno')!);
    expect(furniturePhotoSource(item)?.kind).toBe('boxes');
  });
});
