'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { visualSampleDocument } from './visual-sample';

const EditorShell = dynamic(
  () => import('@/components/editor-v2/editor-shell').then((module) => module.EditorShell),
  { ssr: false, loading: () => <p role="status">Cargando el editor…</p> },
);

export function EditorPreview({ visualSample = false }: { visualSample?: boolean }) {
  const storageKey = visualSample ? 'habiteka:dev-preview-visual-sample-v3' : 'habiteka:dev-preview-document';
  const [store] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return createEditorStore(parseEditorDocument(JSON.parse(saved)));
    } catch { /* No sustituir ni borrar una copia que no pueda leerse. */ }
    return createEditorStore(visualSample ? visualSampleDocument() : emptyEditorDocument());
  });
  const [status, setStatus] = useState('Preparando copia de esta pestaña…');
  const resetVisualSample = () => store.setState((state) => ({
    document: visualSampleDocument(), past: [...state.past, state.document].slice(-100), future: [],
    selection: [], tool: 'select', sequence: state.sequence + 1,
  }));
  useEffect(() => {
    let failed = false;
    let unreadable = false;
    try {
      const existing = sessionStorage.getItem(storageKey);
      if (existing) parseEditorDocument(JSON.parse(existing));
    } catch { unreadable = true; }
    const persist = () => {
      if (unreadable) {
        failed = true; setStatus('La copia anterior no puede leerse y se conserva sin sobrescribir.');
        return;
      }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(store.getState().document));
        failed = false; setStatus('Copia en esta pestaña · no guardado en proyecto');
      } catch {
        failed = true; setStatus('No se puede conservar la copia. No recargues esta pestaña.');
      }
    };
    const warn = (event: BeforeUnloadEvent) => { if (failed) { event.preventDefault(); event.returnValue = ''; } };
    persist();
    const unsubscribe = store.subscribe(persist);
    window.addEventListener('beforeunload', warn);
    return () => { unsubscribe(); window.removeEventListener('beforeunload', warn); };
  }, [store, storageKey]);
  return (
    <main className="flex h-dvh flex-col">
      <aside role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950">
        Vista previa en construcción · Lienzo independiente, no es tu plano cargado.
        {' '}La copia de esta pestaña permite recargar, pero no garantiza recuperación al cerrarla. Guardado en proyecto e importación pendientes.
        {visualSample && <button type="button" className="ml-3 underline" onClick={resetVisualSample}>
          Restablecer vivienda de muestra
        </button>}
      </aside>
      <EditorShell store={store} projectName={visualSample ? 'Vivienda de muestra · Vista previa' : 'Nuevo plano · Vista previa'}
        saveStatus={status} />
    </main>
  );
}
