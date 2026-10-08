import type { EditorStore, EditorTool } from './store';

export type EditorViewMode = '2d' | 'visual' | '3d';

export function viewForTool(mode: EditorViewMode, tool: EditorTool): EditorViewMode {
  if (tool === 'select') return mode;
  if (tool === 'place-object') return mode === '3d' ? 'visual' : mode;
  return '2d';
}

/** Cambiar de vista nunca descarta una operación sin confirmar. */
export function viewModeBlockedReason(tool: EditorTool, mode: EditorViewMode): string | null {
  if (mode === '2d' || tool === 'select' || (mode === 'visual' && tool === 'place-object')) return null;
  return tool === 'place-object'
    ? 'Coloca o cancela el objeto antes de abrir Modelo 3D.'
    : 'Finaliza el trazo o la herramienta antes de cambiar de vista.';
}

export function prepareViewChange(store: EditorStore, previous: EditorViewMode, next: EditorViewMode): boolean {
  const state = store.getState();
  if (viewModeBlockedReason(state.tool, next)) return false;
  if (next === '3d' && previous !== '3d') state.setCeilingView('hidden');
  return true;
}
