'use client';
import { useState } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EditorScope } from '@/server/editor/authority';
import { listStudioDeletedImages, removeStudioImages, restoreStudioImages } from '@/server/walkthrough/studio-media-actions';
import { callAction } from '@/lib/action-result';

export function useRenderCleanup(scope: EditorScope, onChanged: (ids: string[], removed: boolean) => Promise<void>, onBusyChange?: (busy: boolean) => void) {
  const [selecting, setSelecting] = useState(false), [ids, setIds] = useState<string[]>([]), [undoIds, setUndoIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [trash, setTrash] = useState<{ id: string; label: string; url: string | null }[] | null>(null);
  async function loadTrash() {
    if (busy) return;
    setBusy(true); onBusyChange?.(true);
    try { setTrash(await callAction(listStudioDeletedImages(scope))); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo abrir la papelera.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  async function change(selected: string[], remove: boolean) {
    if (!selected.length || busy) return;
    setBusy(true); onBusyChange?.(true); setMessage('');
    try {
      await callAction(remove ? removeStudioImages(scope, selected) : restoreStudioImages(scope, selected));
      setUndoIds(remove ? selected : undoIds.filter(id => !selected.includes(id)));
      setIds([]); setMessage(remove ? `${selected.length === 1 ? 'Imagen movida' : `${selected.length} imágenes movidas`} a la papelera. Puedes deshacerlo aquí.` : 'Imágenes restauradas.');
      await onChanged(selected, remove);
      if (trash !== null) setTrash(await callAction(listStudioDeletedImages(scope)));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo actualizar la selección.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return { selecting, setSelecting, ids, setIds, undoIds, busy, message, change, trash, setTrash, loadTrash,
    toggle: (id: string) => setIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 200 ? [...current, id] : current) };
}
type Cleanup = ReturnType<typeof useRenderCleanup>;
export function RenderCleanupToolbar({ cleanup, images, disabled = false }: { cleanup: Cleanup; images: { id: string; issue?: string }[]; disabled?: boolean }) {
  const activeIds = cleanup.ids.filter(id => images.some(image => image.id === id));
  return <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3">
    <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => { cleanup.setSelecting(!cleanup.selecting); cleanup.setIds([]); }}>
      <Trash2 size={14} />{cleanup.selecting ? 'Terminar limpieza' : 'Limpiar imágenes'}</Button>
      {cleanup.selecting && <><Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => cleanup.setIds(images.slice(0, 200).map(image => image.id))}>{images.length > 200 ? 'Seleccionar primeras 200' : 'Seleccionar todas'}</Button>
        {images.some(image => image.issue) && <Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => cleanup.setIds(images.filter(image => image.issue).slice(0, 200).map(image => image.id))}>Seleccionar no válidas (máx. 200)</Button>}
        <Button type="button" size="sm" disabled={disabled || cleanup.busy || !activeIds.length} onClick={() => void cleanup.change(activeIds, true)}>Mover {activeIds.length} a la papelera</Button></>}
      {!!cleanup.undoIds.length && <Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => void cleanup.change(cleanup.undoIds, false)}><Undo2 size={14} />Deshacer limpieza</Button>}
      <Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => cleanup.trash === null ? void cleanup.loadTrash() : cleanup.setTrash(null)}>{cleanup.trash === null ? 'Papelera de imágenes' : 'Cerrar papelera'}</Button>
    </div>
    <p className="text-xs text-ink-soft">Puedes quitar cualquier imagen, incluso las no válidas. Se ocultan de Diseños y Crear vídeo; los vídeos ya guardados se conservan. Hasta 200 por selección.</p>
    {cleanup.message && <p role="status" className="text-sm">{cleanup.message}</p>}
    {cleanup.trash !== null && <section aria-label="Papelera de imágenes" className="space-y-2">
      <p className="text-xs text-ink-soft">Puedes restaurarlas después de cerrar el estudio. La política de retención predeterminada es de 30 días. Se muestran hasta 200; al restaurar aparecen las siguientes.</p>
      {!cleanup.trash.length ? <p className="text-sm">La papelera de esta zona está vacía.</p> : <>
        <Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => void cleanup.change(cleanup.trash!.map(image => image.id), false)}>Restaurar las mostradas</Button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{cleanup.trash.map(image => <article key={image.id} className="space-y-2 rounded-control border border-line bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image.url && <img src={image.url} alt={image.label} className="aspect-video w-full object-cover" loading="lazy" />}
          <p className="text-xs">{image.label}</p><Button type="button" size="sm" variant="outline" disabled={disabled || cleanup.busy} onClick={() => void cleanup.change([image.id], false)}>Restaurar</Button>
        </article>)}</div>
      </>}
    </section>}
  </div>;
}
export function RenderCleanupCardActions({ cleanup, id, label, disabled = false }: { cleanup: Cleanup; id: string; label: string; disabled?: boolean }) {
  return <div className={`absolute right-2 top-2 z-10 flex items-center gap-2 ${cleanup.selecting ? '' : 'sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
    {cleanup.selecting && <input type="checkbox" aria-label={`Seleccionar para eliminar ${label}`} checked={cleanup.ids.includes(id)} disabled={disabled || cleanup.busy} onChange={() => cleanup.toggle(id)} className="h-5 w-5 accent-brand-600" />}
    <button type="button" aria-label={`Eliminar imagen ${label}`} title="Mover imagen a la papelera" disabled={disabled || cleanup.busy}
      onClick={() => void cleanup.change([id], true)} className="rounded-control border border-line bg-surface p-2 text-ink shadow-sm hover:text-danger disabled:opacity-50"><Trash2 size={15} /></button>
  </div>;
}
