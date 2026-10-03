'use client';
import { Dialog } from 'radix-ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DeliverableView } from './deliverables-panel';
import { renderImageLabel } from '@/lib/editor-document/render-gallery';
import { renderGalleryState, type RenderAcceptanceSnapshot } from '@/lib/editor-document/render-gallery-state';
import { DeliverableActions } from './deliverable-actions';
import { UseAsBackgroundButton } from './use-as-background-button';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import { LegalSeal } from './legal-seal';
import { RenderAcceptance } from './render-acceptance';
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
          if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest('input,textarea,select,form,[contenteditable="true"],[role="combobox"],[role="slider"]')) return;
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
        {item?.payload.type === 'render3d' && <div className={styles.body}>
          <div className={styles.preview}>
            <div className={styles.image}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de storage firmada */}
              <img src={item.payload.assetUrl} alt={`${label?.zone} · ${label?.view}`} />
              <LegalSeal />
            </div>
            <nav aria-label="Imágenes de la tanda" className="flex shrink-0 items-center justify-center gap-4 border-t border-line bg-surface px-3 py-2">
              <button type="button" aria-label="Imagen anterior" disabled={total < 2} onClick={() => onMove(-1)} className={styles.arrow}><ChevronLeft size={20} /></button>
              <span className="text-xs text-ink-soft">{index + 1} / {total}</span>
              <button type="button" aria-label="Imagen siguiente" disabled={total < 2} onClick={() => onMove(1)} className={styles.arrow}><ChevronRight size={20} /></button>
            </nav>
          </div>
          <aside aria-label="Revisión y acciones de la imagen" className={styles.actions}>
            <h3 className="text-sm font-semibold">Revisar diseño</h3>
            <RenderAcceptance key={`acceptance:${item.id}`} item={item} projectId={projectId} saved={saved} onChanged={onChanged} />
            <div className="space-y-3 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Acciones de imagen</h3>
              <DeliverableActions key={item.id} projectId={projectId} deliverable={item} highlightChanges={item.quality?.decision === 'block'}
                leadingAction={<UseAsBackgroundButton projectId={projectId} assetUrl={item.payload.assetUrl} zoneId={item.zoneId} deliverableId={item.id} />} />
            </div>
            {item.quality && <QualityVerdictCard quality={item.quality} compact />}
          </aside>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
