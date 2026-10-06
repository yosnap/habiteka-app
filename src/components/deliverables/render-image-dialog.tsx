'use client';
import { Dialog } from 'radix-ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import type { CanvasZone } from '@/lib/contracts';
import type { DeliverableView } from './deliverables-panel';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import { renderGalleryState, type RenderAcceptanceSnapshot } from '@/lib/editor-document/render-gallery-state';
import { DeliverableActions } from './deliverable-actions';
import { UseAsBackgroundButton } from './use-as-background-button';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import { RenderRegionImage } from './render-region-image';
import { RenderAcceptance } from './render-acceptance';
import { RenderFidelityCard } from './render-fidelity-card';
import { canCloseRoof, RoofClosureButton } from './roof-closure-button';
import styles from './render-image-dialog.module.css';

export function RenderImageDialog({ item, projectId, index, total, saved, onChanged, onMove, onClose, onRestoreFocus }: {
  item: DeliverableView | undefined; projectId: string; index: number; total: number;
  saved?: RenderAcceptanceSnapshot; onChanged: (value: RenderAcceptanceSnapshot) => void;
  onMove: (delta: number) => void; onClose: () => void; onRestoreFocus: () => void;
}) {
  const label = item ? renderImageLabel(item) : null;
  const version = item ? renderGalleryState(item, saved).version : null;
  return <Dialog.Root open={Boolean(item)} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/60" />
      <Dialog.Content className={styles.dialog} onInteractOutside={event => event.preventDefault()}
        onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }}
        onEscapeKeyDown={event => { event.stopPropagation(); event.preventDefault(); onClose(); }}
        onKeyDown={event => {
          // El visor también se abre dentro del generador: Escape cierra solo esta imagen.
          if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); onClose(); return; }
          if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest('input,textarea,select,form,[data-image-zone-editor],[contenteditable="true"],[role="combobox"],[role="slider"]')) return;
          if (total > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault(); event.stopPropagation(); onMove(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-4">
          <div className="min-w-0" aria-live="polite">
            <Dialog.Title className="font-semibold">{label?.zone} · {label?.view}</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-ink-soft">Imagen {index + 1} de {total} · versión {version}</Dialog.Description>
          </div>
          <Dialog.Close aria-label="Cerrar imagen" className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line focus-visible:outline-2 focus-visible:outline-brand-500"><X size={18} /></Dialog.Close>
        </header>
        {item?.payload.type === 'render3d' && <RenderImageBody key={item.id} item={item} projectId={projectId}
          index={index} total={total} saved={saved} onChanged={onChanged} onMove={onMove} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function RenderImageBody({ item, projectId, index, total, saved, onChanged, onMove }: {
  item: DeliverableView; projectId: string; index: number; total: number;
  saved?: RenderAcceptanceSnapshot; onChanged: (value: RenderAcceptanceSnapshot) => void; onMove: (delta: number) => void;
}) {
  const [scope, setScope] = useState<'region' | 'whole'>('region');
  const [zone, setZone] = useState<CanvasZone | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const label = renderImageLabel(item);
  if (item.payload.type !== 'render3d') return null;
  return <div className={styles.body}>
          <div className={styles.preview}>
            <RenderRegionImage url={item.payload.assetUrl} label={`${label.zone} · ${label.view}`}
              active={editing && scope === 'region'} disabled={pending} zone={zone} onZone={setZone} />
            <nav aria-label="Imágenes de la tanda" className="flex shrink-0 items-center justify-center gap-4 border-t border-line bg-surface px-3 py-2">
              <button type="button" aria-label="Imagen anterior" disabled={pending || total < 2} onClick={() => onMove(-1)} className={styles.arrow}><ChevronLeft size={20} /></button>
              <span className="text-xs text-ink-soft">{index + 1} / {total}</span>
              <button type="button" aria-label="Imagen siguiente" disabled={pending || total < 2} onClick={() => onMove(1)} className={styles.arrow}><ChevronRight size={20} /></button>
            </nav>
          </div>
          <aside aria-label="Revisión y acciones de la imagen" className={styles.actions}>
            <h3 className="text-sm font-semibold">Revisar diseño</h3>
            <RenderAcceptance key={`acceptance:${item.id}`} item={item} projectId={projectId} saved={saved} onChanged={onChanged} />
            <RenderFidelityCard report={item.payload.generation?.fidelity} model={item.payload.generation?.model} />
            <div className="space-y-3 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Acciones de imagen</h3>
              {canCloseRoof(item, renderGalleryState(item, saved).accepted) && <RoofClosureButton projectId={projectId} item={item} />}
              <DeliverableActions key={item.id} projectId={projectId} deliverable={item} highlightChanges={item.quality?.decision === 'block'}
                imageEditor={{ scope, zone, onScopeChange: setScope, onClear: () => setZone(null), onOpenChange: setEditing, onPendingChange: setPending }}
                leadingAction={<UseAsBackgroundButton projectId={projectId} assetUrl={item.payload.assetUrl} zoneId={item.zoneId} deliverableId={item.id} />} />
            </div>
            {item.quality && <QualityVerdictCard quality={item.quality} compact />}
          </aside>
        </div>;
}
