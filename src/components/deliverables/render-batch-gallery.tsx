'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DeliverableView } from './deliverables-panel';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import { DeliverableActions } from './deliverable-actions';
import { UseAsBackgroundButton } from './use-as-background-button';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import { LegalSeal } from './legal-seal';
import { RenderAcceptance } from './render-acceptance';

export function RenderBatchGallery({ items, projectId }: { items: DeliverableView[]; projectId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<Record<string, { accepted: boolean; version: number }>>({});
  const index = items.findIndex(item => item.id === selectedId), selected = items[index];
  const zones = [...new Set(items.map(item => renderImageLabel(item).zone))];
  const title = `Render 3D · ${zones.length > 3 ? `${zones.slice(0, 2).join(' / ')} y ${zones.length - 2} estancias más` : zones.join(' / ')}`;
  const label = selected ? renderImageLabel(selected) : null;
  const move = (delta: number) => setSelectedId(items[(index + delta + items.length) % items.length]!.id);
  return <section aria-label={title} className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
    <header className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold text-ink">{title}</h2><p className="mt-1 text-xs text-ink-soft">Abre una imagen para descargarla o trabajar con ella.</p></div>
      <span className="shrink-0 rounded-control bg-surface-muted px-2 py-1 text-xs text-ink-soft">{items.length} {items.length === 1 ? 'imagen' : 'imágenes'}</span>
    </header>
    <div className={`grid gap-3 ${items.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>
      {items.map(item => {
        if (item.payload.type !== 'render3d') return null;
        const context = renderImageLabel(item);
        return <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}
          aria-label={`Abrir ${context.zone} · ${context.view}`} className="group cursor-pointer overflow-hidden rounded-control border border-line text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500">
          <div className="relative aspect-video bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL de storage firmada */}
            <img src={item.payload.assetUrl} alt={`${context.zone} · ${context.view}`} className="h-full w-full object-contain" loading="lazy" />
          </div>
          <div className="px-3 py-2"><span className="text-sm font-medium">{context.view}</span>
            <p className="truncate text-xs text-ink-soft">{context.zone}</p></div>
        </button>;
      })}
    </div>
    <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/60" />
        <Dialog.Content className="fixed inset-2 z-[151] flex flex-col overflow-hidden rounded-card bg-surface text-ink shadow-2xl sm:inset-x-[5vw] sm:inset-y-[4vh]"
          onInteractOutside={event => event.preventDefault()} onKeyDown={event => {
            if ((event.target as HTMLElement).closest('input,textarea,select,form,button')) return;
            if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1);
          }}>
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-4">
            <div><Dialog.Title className="font-semibold">{label?.zone} · {label?.view}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-ink-soft">Imagen {index + 1} de {items.length} · versión {selected?.version}</Dialog.Description></div>
            <Dialog.Close aria-label="Cerrar imagen" className="cursor-pointer rounded-control border border-line p-2"><X size={18} /></Dialog.Close>
          </header>
          {selected?.payload.type === 'render3d' && <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="relative flex h-[55vh] min-h-52 items-center justify-center bg-surface-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de storage firmada */}
              <img src={selected.payload.assetUrl} alt={`${label?.zone} · ${label?.view}`} className="h-full w-full object-contain" />
              <LegalSeal />
              {items.length > 1 && <><button type="button" aria-label="Imagen anterior" onClick={() => move(-1)} className="absolute left-3 cursor-pointer rounded-full border bg-surface p-2 shadow"><ChevronLeft size={20} /></button>
                <button type="button" aria-label="Imagen siguiente" onClick={() => move(1)} className="absolute right-3 cursor-pointer rounded-full border bg-surface p-2 shadow"><ChevronRight size={20} /></button></>}
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <RenderAcceptance key={`acceptance:${selected.id}`} item={selected} projectId={projectId} saved={acceptances[selected.id]}
                onChanged={value => setAcceptances(current => ({ ...current, [selected.id]: value }))} />
              <DeliverableActions key={selected.id} projectId={projectId} deliverable={selected} highlightChanges={selected.quality?.decision === 'block'}
                leadingAction={<UseAsBackgroundButton projectId={projectId} assetUrl={selected.payload.assetUrl} zoneId={selected.zoneId} deliverableId={selected.id} />} />
              {selected.quality && <QualityVerdictCard quality={selected.quality} compact />}
            </div>
          </div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}
