import { expect, it } from 'vitest';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { catalogFurnitureVolumes, isPainted } from '@/lib/editor-document/furniture-profiles';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { paintElement } from '@/lib/editor-document/spatial-commands';

it('pintar un módulo de cocina tiñe cuerpo y encimera y conserva los herrajes; sin pintar, los acentos siguen', () => {
  const kitchen = FURNITURE_CATALOG.find((e) => e.id === 'habiteka:furniture:mueble-cocina')!;
  let doc = addFurniture(emptyEditorDocument(), kitchen, { x: 1000, y: 1000 });
  const item = doc.furniture[0]!;
  expect(isPainted(item)).toBe(false);
  const before = catalogFurnitureVolumes(item)!;
  expect(before.some((v) => v.color === '#e0dbcf')).toBe(true);
  doc = paintElement(doc, item.id, 'body', '#1f4e79');
  const painted = doc.furniture[0]!, volumes = catalogFurnitureVolumes(painted)!;
  expect(isPainted(painted)).toBe(true);
  expect(volumes.filter((v) => v.color === '#1f4e79').length).toBe(2);
  expect(volumes.some((v) => v.color === '#444944')).toBe(true);
});
