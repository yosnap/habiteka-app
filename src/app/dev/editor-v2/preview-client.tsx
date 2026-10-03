'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { visualSampleDocument } from './visual-sample';
import { buildingSampleDocument } from './building-sample';
import { constructionSampleDocument } from './construction-sample';
import { resetPreviewSample } from './reset-preview-sample';

const EditorShell = dynamic(
  () => import('@/components/editor-v2/editor-shell').then((module) => module.EditorShell),
  { ssr: false, loading: () => <p role="status">Cargando el editor…</p> },
);

export function EditorPreview({ sample = null }: { sample?: 'visual' | 'plantas' | 'obra' | null }) {
  const storageKey = sample === 'visual' ? 'habiteka:dev-preview-visual-sample-v3'
    : sample === 'plantas' ? 'habiteka:dev-preview-building-sample-v1' : sample === 'obra' ? 'habiteka:dev-preview-construction-v1' : 'habiteka:dev-preview-document';
  const sampleDocument = () => sample === 'visual' ? visualSampleDocument()
    : sample === 'plantas' ? buildingSampleDocument() : sample === 'obra' ? constructionSampleDocument() : emptyEditorDocument();
  const [store, setStore] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return createEditorStore(parseEditorDocument(JSON.parse(saved)));
    } catch { /* No sustituir ni borrar una copia que no pueda leerse. */ }
    return createEditorStore(sampleDocument());
  });
  const [status, setStatus] = useState('Preparando copia de esta pestaña…');
  const [resetVersion, setResetVersion] = useState(0);
  const [resetFeedback, setResetFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const resetSample = () => {
    try {
      const nextStore = resetPreviewSample(store, sampleDocument());
      setStore(nextStore);
      // La cámara y los trazos pendientes también viven en componentes, no solo en el store.
      setResetVersion((version) => version + 1);
      setResetFeedback({ message: 'Muestra restablecida. Plano 2D encuadrado; puedes deshacer para recuperar tus cambios.', error: false });
    } catch {
      setResetFeedback({ message: 'No se pudo restablecer la muestra. Tu copia actual se conserva.', error: true });
    }
  };
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
      <aside className="bg-amber-100 px-4 py-2 text-sm text-amber-950">
        Vista previa en construcción · Lienzo independiente, no es tu plano cargado.
        {' '}La copia de esta pestaña permite recargar, pero no garantiza recuperación al cerrarla. Guardado en proyecto e importación pendientes.
        {sample && <button type="button" className="ml-3 underline" onClick={resetSample}>
          Restablecer muestra
        </button>}
        {resetFeedback && <p key={resetVersion} role={resetFeedback.error ? 'alert' : 'status'} className="mt-1 font-medium">
          {resetFeedback.message}
        </p>}
      </aside>
      <EditorShell key={resetVersion} store={store} projectName={sample === 'visual' ? 'Vivienda de muestra · Vista previa'
        : sample === 'plantas' ? 'Dos plantas de muestra · Vista previa' : 'Nuevo plano · Vista previa'}
        saveStatus={status} allowVideoExport={sample === 'obra'} />
    </main>
  );
}
