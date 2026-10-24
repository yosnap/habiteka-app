import { expect, it } from 'vitest';
import { DEFAULT_SCENE_OPTIONS, parseWorkspaceDisplay } from '@/canvas/editor-v2/workspace-display';
import { workspaceNameLabels } from '@/canvas/editor-v2/workspace-name-labels';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

it('recupera preferencias de etiquetas y limita valores locales dañados', () => {
  expect(parseWorkspaceDisplay('invalid')).toEqual(DEFAULT_SCENE_OPTIONS);
  const recovered = parseWorkspaceDisplay(JSON.stringify({ names: false, gridStep: 0, units: 'imperial',
    nameStyle: { size: 200, radius: -3, font: 'unknown', color: 'red', background: '#123456', bold: false } }));
  expect(recovered.names).toBe(false);
  expect(recovered.units).toBe('imperial');
  expect(recovered.gridStep).toBe(1);
  expect(recovered.nameStyle).toMatchObject({ size: 24, radius: 0, font: 'sans', color: '#29413c', background: '#123456', bold: false });
});

it('las vistas usan el mismo nombre y posición y no duplican estancias con etiqueta', () => {
  const document = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const initial = JSON.stringify(document);
  const fallback = workspaceNameLabels(document);
  expect(fallback).toHaveLength(1);
  expect(fallback[0]).toMatchObject({ text: 'Estancia 1', editable: false });
  document.labels.push({ id: 'living', text: 'Salón', x: 1100, y: 1700 });
  expect(workspaceNameLabels(document)).toEqual([expect.objectContaining({ id: 'living', text: 'Salón', x: 1100, y: 1700, editable: true, roomId: fallback[0]!.roomId })]);
  expect(workspaceNameLabels(document, ['living'])).toEqual([]);
  expect(workspaceNameLabels(document, [fallback[0]!.roomId!])).toEqual([]);
  expect(JSON.stringify({ ...document, labels: [] })).toBe(initial);
});

it('cambiar presentación conserva ajustes compartidos sin modificar la revisión del plano', () => {
  const store = createEditorStore(emptyEditorDocument());
  const original = store.getState().document;
  const options = { ...DEFAULT_SCENE_OPTIONS, names: false, nameStyle: { ...DEFAULT_SCENE_OPTIONS.nameStyle, font: 'serif' as const } };
  store.getState().setSceneOptions(options);
  store.getState().setCeilingView('hidden');
  store.getState().requestView('fit');
  expect(store.getState().sceneOptions).toBe(options);
  expect(store.getState().document).toBe(original);
  expect(store.getState().past).toEqual([]);
});
