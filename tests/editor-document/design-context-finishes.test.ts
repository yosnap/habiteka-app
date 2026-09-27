import { expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

it('entrega a la propuesta los acabados existentes de ambas caras y el estilo de la planta', () => {
  const doc = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  doc.designStyle = 'mediterraneo';
  doc.walls[0]!.materials = { left: 'polyhaven:wood_floor', right: 'plaster-white' };
  const context = editorDesignContext(doc);
  expect(context.designStyle).toBe('mediterraneo');
  expect(context.levels[0]!.designStyle).toBe('mediterraneo');
  expect(context.levels[0]!.walls[0]!.finishes).toEqual({
    left: { materialId: 'polyhaven:wood_floor', color: null },
    right: { materialId: 'plaster-white', color: null },
  });
  expect(doc.walls[0]!.colors).toBeUndefined();
});
