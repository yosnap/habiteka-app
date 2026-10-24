import type { EditorStore } from './store';
import { expandElementGroups } from '@/lib/editor-document/element-groups';

/** Modificadores de selección compartidos por todas las capas: Mayús, ⌘ o Ctrl añaden o quitan; sin ellos, reemplazan. */
export function clickSelect(store: EditorStore, id: string, event: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } | undefined) {
  const state = store.getState();
  if (!(event?.metaKey || event?.ctrlKey || event?.shiftKey)) return state.select([id]);
  const members = expandElementGroups(state.document, [id]);
  state.select(members.some(member => state.selection.includes(member)) ? state.selection.filter((item) => !members.includes(item)) : [...state.selection, ...members]);
}
