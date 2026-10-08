import { createEditorStore, type EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';

/** Reinicia toda la sesión de la muestra sin perder la opción de recuperar el documento anterior. */
export function resetPreviewSample(previousStore: EditorStore, sample: EditorDocument): EditorStore {
  const previous = previousStore.getState();
  const store = createEditorStore(sample);
  store.setState({
    past: [...previous.past, previous.document].slice(-100),
    sequence: previous.sequence + 1,
  });
  return store;
}
