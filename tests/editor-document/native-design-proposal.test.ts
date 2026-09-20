import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

const proposal: NativeDesignProposal = { style: 'moderno', summary: 'Madera', furniture: [],
  materials: { walls: 'polyhaven:wood_floor', floors: 'polyhaven:wood_floor', stairs: 'polyhaven:wood_floor',
    ramps: 'polyhaven:wood_floor', columns: 'polyhaven:wood_floor' } };
it('aplica a un plano antiguo, actualiza la escena 3D y permite deshacer', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  const store = createEditorStore(source);
  store.getState().apply(applyNativeDesignProposal(source, proposal));
  const next = store.getState().document;
  expect(next.schemaVersion).toBeGreaterThanOrEqual(5);
  expect(next.walls[0]?.materials?.left).toBe('polyhaven:wood_floor');
  expect(next.vertices).toEqual(source.vertices);
  expect(editorDocumentToScene(next).polygons.find(p => p.role === 'floor')?.floorFinish?.texture).toBe('polyhaven:wood_floor');
  expect(store.getState().sequence).toBe(1);
  store.getState().undo(); expect(store.getState().document).toEqual(source);
});
