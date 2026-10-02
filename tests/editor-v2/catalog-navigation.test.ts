import { describe, expect, it } from 'vitest';
import { CATALOG_CATEGORIES, matchesCatalogCategory } from '@/components/editor-v2/catalog-navigation';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { constructionGroup } from '@/lib/editor-document/element-classification';

const furnishings = FURNITURE_CATALOG.filter(item => !constructionGroup(item));

describe('navegación por categorías del catálogo', () => {
  it('permite encontrar cada mueble y variante en una única categoría', () => {
    const missingOrRepeated = furnishings.filter(item =>
      CATALOG_CATEGORIES.filter(category => matchesCatalogCategory(item, category.id)).length !== 1);
    expect(missingOrRepeated.map(item => item.id)).toEqual([]);
  });

  it('no mezcla camas con sofás al filtrar y conserva las variantes', () => {
    const sofas = furnishings.filter(item => matchesCatalogCategory(item, 'seating'));
    expect(sofas.length).toBeGreaterThan(0);
    expect(sofas.every(item => item.profile.startsWith('sofa'))).toBe(true);
    expect(sofas.some(item => item.variantLabel !== 'Original')).toBe(true);
    expect(furnishings.filter(item => item.profile === 'bed').every(item =>
      matchesCatalogCategory(item, 'beds') && !matchesCatalogCategory(item, 'seating'))).toBe(true);
  });

  it('volver a todos los muebles elimina el filtro y rechaza categorías desconocidas', () => {
    expect(furnishings.every(item => matchesCatalogCategory(item, ''))).toBe(true);
    expect(furnishings.some(item => matchesCatalogCategory(item, 'inexistente'))).toBe(false);
  });
});
