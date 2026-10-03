'use client';
import { useRef, useState } from 'react';
import type { DeliverableView } from './deliverables-panel';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import { renderBatchCounts, renderGalleryState, RENDER_STATUS_LABELS, type RenderAcceptanceSnapshot } from '@/lib/editor-document/render-gallery-state';
import { RenderStatusBadge } from './render-status-badge';
import { RenderImageDialog } from './render-image-dialog';

export function RenderBatchGallery({ items, projectId }: { items: DeliverableView[]; projectId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<Record<string, RenderAcceptanceSnapshot>>({});
  const opener = useRef<HTMLButtonElement | null>(null);
  const index = items.findIndex(item => item.id === selectedId), selected = items[index];
  const zones = [...new Set(items.map(item => renderImageLabel(item).zone))];
  const title = `Diseños · ${zones.length > 3 ? `${zones.slice(0, 2).join(' / ')} y ${zones.length - 2} zonas más` : zones.join(' / ')}`;
  const counts = renderBatchCounts(items, acceptances);
  const revisions = [...new Set(items.flatMap(item => item.payload.type === 'render3d' && item.payload.generation ? [item.payload.generation.documentRevision] : []))];
  const move = (delta: number) => setSelectedId(items[(index + delta + items.length) % items.length]!.id);
  return <section aria-label={title} className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
    <header className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold text-ink">{title}</h2><p className="mt-1 text-xs text-ink-soft">Abre cada imagen para revisarla y decidir si aceptas el diseño.</p>
        {revisions.length > 0 && <p className="mt-1 text-xs text-ink-soft">{revisions.length === 1 ? 'Revisión del plano' : 'Revisiones del plano'}: {revisions.join(', ')}</p>}</div>
      <span className="shrink-0 rounded-control bg-surface-muted px-2 py-1 text-xs text-ink-soft">{items.length} {items.length === 1 ? 'imagen' : 'imágenes'}</span>
    </header>
    <p className="text-xs text-ink-soft" aria-live="polite">{(Object.keys(counts) as Array<keyof typeof counts>).filter(status => counts[status] > 0).map(status => `${RENDER_STATUS_LABELS[status]}: ${counts[status]}`).join(' · ')}</p>
    <div className={`grid gap-3 ${items.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>
      {items.map(item => {
        if (item.payload.type !== 'render3d') return null;
        const context = renderImageLabel(item);
        const { status } = renderGalleryState(item, acceptances[item.id]);
        return <button type="button" key={item.id} onClick={event => { opener.current = event.currentTarget; setSelectedId(item.id); }}
          aria-label={`Abrir ${context.zone} · ${context.view} · ${RENDER_STATUS_LABELS[status]}`} aria-haspopup="dialog" className="group cursor-pointer overflow-hidden rounded-control border border-line text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500">
          <div className="relative aspect-video bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL de storage firmada */}
            <img src={item.payload.assetUrl} alt={`${context.zone} · ${context.view}`} className="h-full w-full object-contain" loading="lazy" />
          </div>
          <div className="space-y-2 px-3 py-3"><div><span className="text-sm font-medium">{context.view}</span>
            <p className="truncate text-xs text-ink-soft" title={context.zone}>{context.zone}</p></div><RenderStatusBadge status={status} /></div>
        </button>;
      })}
    </div>
    <RenderImageDialog item={selected} projectId={projectId} index={index} total={items.length} saved={selected ? acceptances[selected.id] : undefined}
      onChanged={value => { if (selected) setAcceptances(current => ({ ...current, [selected.id]: value })); }}
      onMove={move} onClose={() => setSelectedId(null)} onRestoreFocus={() => opener.current?.focus()} />
  </section>;
}
