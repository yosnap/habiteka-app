import { expect, it } from 'vitest';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { constructionGroup, elementName, CONSTRUCTION_GROUPS } from '@/lib/editor-document/element-classification';
it('clasifica exteriores construidos sin mezclar pufs e iluminación', () => {
  for (const kind of ['arbol', 'valla-madera', 'seto', 'parking', 'piscina', 'barbacoa']) {
    expect(CONSTRUCTION_GROUPS).toContain(constructionGroup(OUTDOOR_CATALOG.find((item) => item.kind === kind)!));
  }
  for (const kind of ['puf-exterior', 'tira-led']) expect(constructionGroup(OUTDOOR_CATALOG.find((item) => item.kind === kind)!)).toBeUndefined();
});
it('usa nombre real del catálogo y prioriza el personalizado sin cambiar IDs guardados', () => {
  const pool = OUTDOOR_CATALOG.find((item) => item.kind === 'piscina')!;
  expect(elementName({ catalogId: pool.id, kind: pool.kind })).toBe('Piscina elevada');
  expect(elementName({ catalogId: pool.id, kind: pool.kind, name: 'Piscina principal' })).toBe('Piscina principal');
});
