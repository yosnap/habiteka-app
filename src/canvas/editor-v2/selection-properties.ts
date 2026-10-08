import type { EditorDocument } from '@/lib/editor-document/schema';
import { bulkCategory, bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';
import type { EditorStore } from './store';

/** Solo se ofrecen campos comunes cuando toda la selección admite edición en bloque. */
export function selectionPropertyScope(document: EditorDocument, selection: string[]) {
  const id = selection[0];
  const peers = id ? bulkPeers(document, id, selection) : [];
  const multiple = selection.length > 1;
  const category = id ? bulkCategory(document, id) : undefined;
  return { multiple, peers, category, mixed: multiple && peers.length !== selection.length - 1 };
}

/** Una edición compartida es atómica: si un elemento no admite el cambio, no se aplica ninguno. */
export function editSelectionProperties(store: EditorStore, operation: (document: EditorDocument) => EditorDocument) {
  const state = store.getState();
  const id = state.selection[0];
  if (state.readOnly || !id) return false;
  const { mixed, peers } = selectionPropertyScope(state.document, state.selection);
  if (mixed) { state.setError('Selecciona elementos del mismo tipo para editar sus propiedades a la vez.'); return false; }
  try {
    const next = operation(state.document);
    state.apply(propagateToPeers(state.document, next, id, peers));
    return true;
  } catch (error) {
    state.setError(error instanceof Error ? error.message : 'No se pudo editar la selección.');
    return false;
  }
}

/** Buscar cambia la selección sin cerrar el inspector ni cancelar sus controles. */
export function selectPropertyElement(store: EditorStore, id: string) {
  const state = store.getState();
  if (state.tool !== 'select') state.setTool('select');
  state.openSidePanel('inspector');
  state.select(id ? [id] : []);
}
