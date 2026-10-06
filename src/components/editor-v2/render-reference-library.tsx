'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RenderAcceptance } from '@/components/deliverables/render-acceptance';
import { RenderStatusBadge } from '@/components/deliverables/render-status-badge';
import { renderGalleryState, type RenderAcceptanceSnapshot } from '@/lib/editor-document/render-gallery-state';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { optionsFromReference, referenceSettingIssues, requiredReferencePreset } from '@/lib/editor-document/render-reference-compatibility';
import { LIGHTING_LABELS } from '@/lib/lighting-preset';
import { listRenderReferences } from '@/server/agent/editor-v2/render-reference-actions';

type Choice = Awaited<ReturnType<typeof listRenderReferences>>['items'][number];
export function RenderReferenceLibrary({ projectId, zoneId, document, view, options, disabled, selectedId, onSelect, onAdopt }: {
  projectId: string; zoneId: string | null; document: EditorDocument; view: RenderView; options: RenderDesignOptions;
  disabled: boolean; selectedId?: string; onSelect: (id?: string) => void;
  onAdopt: (options: RenderDesignOptions, id: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [items, setItems] = useState<Choice[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null), [saved, setSaved] = useState<Record<string, RenderAcceptanceSnapshot>>({});
  const preset = requiredReferencePreset(view, options);
  if (!preset) return null;
  const label = preset === 'top' ? 'cenital' : 'isométrica';
  async function load(more = false) {
    setOpen(true); setBusy(true); setError('');
    try {
      const result = await listRenderReferences({ projectId, zoneId }, document, view, options, more ? cursor ?? undefined : undefined);
      setItems(previous => more ? [...previous, ...result.items] : result.items); setCursor(result.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir la biblioteca.'); }
    finally { setBusy(false); }
  }
  return <section aria-label={`Referencia ${label} de la biblioteca`} className="mt-4 space-y-3 rounded-control border border-line p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Referencia {label} del diseño</h3>
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void load()}>Elegir de la biblioteca</Button>
    </div>
    <p className="text-xs text-ink-soft">Reutiliza una imagen guardada de este proyecto y zona. Abre la imagen para revisarla y aceptar su diseño. Consultar, aceptar y seleccionar no consume créditos; generar la nueva vista sí.</p>
    {selectedId && <div className="flex items-center gap-3 text-xs"><span>Referencia seleccionada para esta tanda.</span>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onSelect()}>Quitar selección</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {open && <>
      {busy && <p role="status" className="text-xs">Cargando biblioteca…</p>}
      {!busy && !items.length && <p className="text-xs">No hay imágenes {preset === 'top' ? 'cenitales' : 'isométricas'} guardadas en este proyecto y zona. Genera una y revisa su diseño antes de aceptarlo.</p>}
      <div className="grid max-h-[32rem] gap-3 overflow-y-auto sm:grid-cols-2">
        {items.map(choice => {
          const { item } = choice;
          if (item.payload.type !== 'render3d') return null;
          const state = renderGalleryState(item, saved[item.id]);
          const eligible = state.status === 'accepted' && choice.issues.length === 0;
          const generation = item.payload.generation, recovered = optionsFromReference(generation, options);
          const canRecover = recovered && !referenceSettingIssues(generation, view, recovered).length &&
            !choice.issues.some(issue => /plano actual|archivo de imagen/.test(issue));
          return <article key={item.id} className="space-y-2 rounded-control border border-line p-2">
            <button type="button" className="w-full" aria-label={`Ver ${label} ${item.id}`} disabled={disabled}
              onClick={() => setPreview(preview === item.id ? null : item.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de una imagen del proyecto. */}
              <img src={item.payload.assetUrl} alt={`Diseño ${label} guardado`} className="aspect-video w-full object-contain" />
              <span className="text-xs underline">{preview === item.id ? 'Cerrar imagen' : 'Ver imagen y aceptación'}</span>
            </button>
            <p className="text-xs text-ink-soft">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(choice.createdAt))} · Luz: {generation?.view?.lighting ? LIGHTING_LABELS[generation.view.lighting] : 'sin registrar'} · Libertad: {generation?.options?.freedom ? { strict: 'Estricto', controlled: 'Controlado', free: 'Libre' }[generation.options.freedom] : 'sin registrar'} · Fijos: {generation?.options?.redesignFixed ? 'rediseño permitido' : 'conservados'}</p>
            <RenderStatusBadge status={state.status} />
            {!!choice.issues.length && <ul className="list-disc pl-4 text-xs text-ink-soft">{choice.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
            {canRecover && choice.issues.length > 0 && <Button type="button" className="w-full" variant="outline" disabled={disabled || busy || state.status !== 'accepted'}
              onClick={() => onAdopt(recovered, item.id)}>Usar ajustes de esta referencia</Button>}
            {preview === item.id && <>
              <a href={item.payload.assetUrl} target="_blank" rel="noreferrer" className="block text-xs underline">Abrir imagen a tamaño completo</a>
              <fieldset disabled={disabled}><RenderAcceptance item={item} projectId={projectId} saved={saved[item.id]} onChanged={value => {
                setSaved(previous => ({ ...previous, [item.id]: value }));
                if (!value.accepted && selectedId === item.id) onSelect();
              }} onReviewed={() => void load()} /></fieldset>
            </>}
            <Button type="button" className="w-full" variant={selectedId === item.id ? 'default' : 'outline'} disabled={disabled || busy || !eligible}
              onClick={() => { onSelect(item.id); setOpen(false); }}>{selectedId === item.id ? 'Referencia seleccionada' : 'Usar como referencia'}</Button>
          </article>;
        })}
      </div>
      {cursor && <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => void load(true)}>Ver más imágenes</Button>}
      <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cerrar biblioteca</Button>
    </>}
  </section>;
}
