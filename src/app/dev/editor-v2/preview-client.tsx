'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';

const EditorShell = dynamic(
  () => import('@/components/editor-v2/editor-shell').then((module) => module.EditorShell),
  { ssr: false, loading: () => <p role="status">Cargando el editor…</p> },
);

export function EditorPreview() {
  const [store] = useState(() => {
    try {
      const saved = sessionStorage.getItem('habiteka:dev-preview-document');
      if (saved) return createEditorStore(parseEditorDocument(JSON.parse(saved)));
    } catch { /* No sustituir ni borrar una copia que no pueda leerse. */ }
    return createEditorStore(emptyEditorDocument());
  });
  const [status, setStatus] = useState('Preparando copia de esta pestaña…');
  useEffect(() => {
    let failed = false;
    let unreadable = false;
    try {
      const existing = sessionStorage.getItem('habiteka:dev-preview-document');
      if (existing) parseEditorDocument(JSON.parse(existing));
    } catch { unreadable = true; }
    const persist = () => {
      if (unreadable) {
        failed = true; setStatus('La copia anterior no puede leerse y se conserva sin sobrescribir.');
        return;
      }
      try {
        sessionStorage.setItem('habiteka:dev-preview-document', JSON.stringify(store.getState().document));
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
  }, [store]);
  return (
    <main>
      <aside role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950">
        Vista previa en construcción · Lienzo independiente, no es tu plano cargado.
        {' '}La copia de esta pestaña permite recargar, pero no garantiza recuperación al cerrarla. Guardado en proyecto e importación pendientes.
      </aside>
      <EditorShell store={store} projectName="Nuevo plano · Vista previa"
        saveStatus={status} />
    </main>
  );
}
