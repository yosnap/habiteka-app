'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Info, X } from 'lucide-react';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { visualSampleDocument } from './visual-sample';
import { buildingSampleDocument } from './building-sample';
import { constructionSampleDocument } from './construction-sample';
import { resetPreviewSample } from './reset-preview-sample';
import { SavePreviewDialog } from './save-preview-dialog';

const EditorShell = dynamic(
  () => import('@/components/editor-v2/editor-shell').then((module) => module.EditorShell),
  { ssr: false, loading: () => <p role="status">Cargando el editor…</p> },
);
const subscribeNotice = () => () => {};

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
  const [saveOpen, setSaveOpen] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [resetFeedback, setResetFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const noticeKey = `${storageKey}:notice-dismissed`;
  const persistedDismissed = useSyncExternalStore(subscribeNotice, () => {
    try { return sessionStorage.getItem(noticeKey) === '1'; } catch { return false; }
  }, () => false);
  const [noticeOverride, setNoticeOverride] = useState<boolean | null>(null);
  const noticeDismissed = noticeOverride ?? persistedDismissed;
  const setNoticeDismissed = (dismissed: boolean) => {
    setNoticeOverride(dismissed);
    if (dismissed) setResetFeedback(null);
    try { sessionStorage.setItem(noticeKey, dismissed ? '1' : '0'); } catch { /* Se cierra aunque el navegador no permita persistirlo. */ }
  };
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
      {!noticeDismissed && <aside className="relative bg-amber-100 py-2 pl-4 pr-14 text-sm text-amber-950" aria-label="Información de la muestra">
        <button type="button" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-amber-200"
          aria-label="Cerrar aviso de la muestra" onClick={() => setNoticeDismissed(true)}><X size={20} aria-hidden="true" /></button>
        Vista previa en construcción · Lienzo independiente, no es tu plano cargado.
        {' '}La copia de esta pestaña permite recargar, pero no garantiza recuperación al cerrarla. Usa Guardar para crear un proyecto con tus cambios; requiere iniciar sesión.
        {sample && <button type="button" className="ml-3 underline" onClick={resetSample}>
          Restablecer muestra
        </button>}
        {resetFeedback && <p key={resetVersion} role={resetFeedback.error ? 'alert' : 'status'} className="mt-1 font-medium">
          {resetFeedback.message}
        </p>}
      </aside>}
      {noticeDismissed && <button type="button" className="fixed bottom-3 right-3 z-50 flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs text-amber-950 shadow-sm"
        aria-label="Mostrar información de la muestra" onClick={() => setNoticeDismissed(false)}><Info size={16} aria-hidden="true" />Muestra</button>}
      <EditorShell key={resetVersion} store={store} projectName={sample === 'visual' ? 'Vivienda de muestra · Vista previa'
        : sample === 'plantas' ? 'Dos plantas de muestra · Vista previa' : 'Nuevo plano · Vista previa'}
        saveStatus={status} onSave={() => setSaveOpen(true)} saveEnabled allowVideoExport={sample === 'obra'} />
      <SavePreviewDialog store={store} open={saveOpen} onOpenChange={setSaveOpen} />
    </main>
  );
}
