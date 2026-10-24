'use client';
import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { savePreview } from './save-preview';

export function SavePreviewDialog({ store, open, onOpenChange }: {
  store: EditorStore; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('Mi vivienda');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const request = useRef<{ signature: string; key: string } | null>(null);
  const saving = useRef(false);
  async function save() {
    if (saving.current) return;
    saving.current = true; setPending(true); setError('');
    try {
      const document = store.getState().document;
      const signature = JSON.stringify({ title: title.trim(), document });
      if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
      const result = await savePreview({ title, document, requestKey: request.current.key });
      if (result.error) { setError(result.error); return; }
      // Solo abandonar la muestra después de confirmar la revisión persistida.
      window.location.assign(`/projects/${result.projectId}`);
    } catch { setError('No se pudo confirmar el guardado. Tu copia se conserva; vuelve a intentarlo.'); }
    finally { saving.current = false; setPending(false); }
  }
  return <Dialog.Root open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-surface p-6 text-ink shadow-xl">
        <Dialog.Title className="text-lg font-semibold">Guardar como proyecto</Dialog.Title>
        <Dialog.Description className="my-3 text-sm">Crea un proyecto nuevo con el plano y tus cambios. La copia de la muestra se conserva.</Dialog.Description>
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid gap-4">
          <label className="grid gap-2 text-sm">Nombre del proyecto<input className="rounded-lg border p-3" value={title} required maxLength={120} disabled={pending} onChange={event => setTitle(event.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error} <a href="/acceder" target="_blank" rel="noopener noreferrer" className="underline">Iniciar sesión</a></p>}
          <div className="flex justify-end gap-3">
            <Dialog.Close disabled={pending} className="rounded-lg border px-4 py-3">Cancelar</Dialog.Close>
            <button type="submit" disabled={pending || !title.trim()} className="rounded-lg bg-brand-600 px-4 py-3 text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Crear proyecto y guardar'}</button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
