import type { EditorStore } from './store';

/** Modificadores de selección compartidos por todas las capas: Mayús, ⌘ o Ctrl añaden o quitan; sin ellos, reemplazan. */
export function clickSelect(store: EditorStore, id: string, event: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } | undefined) {
  const state = store.getState();
  if (!(event?.metaKey || event?.ctrlKey || event?.shiftKey)) return state.select([id]);
  state.select(state.selection.includes(id) ? state.selection.filter((item) => item !== id) : [...state.selection, id]);
}
