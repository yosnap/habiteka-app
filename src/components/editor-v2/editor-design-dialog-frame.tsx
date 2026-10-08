'use client';

import { useRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { ZoneOverlayImage } from './zone-overlay-image';

/** Marco compartido: atrapa el foco y restaura el control que abrió cada nivel. */
export function EditorDesignDialogFrame({ title, busy = false, expanded = false, onClose, children }: {
  title: string; busy?: boolean; expanded?: boolean; onClose: () => void; children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={`fixed inset-0 ${expanded ? 'z-[110] bg-black/75' : 'z-50 bg-black/40'}`} />
      <Dialog.Content
        className={`bg-surface text-ink fixed top-1/2 left-1/2 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-line p-4 shadow-2xl sm:max-h-[94dvh] sm:p-6 ${expanded ? 'z-[111] max-w-6xl' : 'z-[51] max-w-4xl'}`}
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); }}
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { event.stopPropagation(); if (busy) event.preventDefault(); }}>
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {!expanded && <p className="text-primary text-xs font-semibold uppercase tracking-[.18em]">Estudio de diseño</p>}
            <Dialog.Title className={`break-words font-semibold ${expanded ? 'text-base' : 'mt-1 text-xl'}`}>{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{expanded ? 'Vista ampliada. Cierra para volver al estudio de diseño.' : 'Configura y revisa tus vistas o una propuesta para el plano.'}</Dialog.Description>
          </div>
          <Dialog.Close disabled={busy} aria-label={expanded ? 'Cerrar vista ampliada' : 'Cerrar estudio de diseño'}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"><X size={18} aria-hidden="true" /></Dialog.Close>
        </header>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function DesignPreviewDialog({ preview, onClose }: {
  preview: { src: string; label: string; maskSrc?: string }; onClose: () => void;
}) {
  return <EditorDesignDialogFrame title={`Vista ampliada: ${preview.label}`} expanded onClose={onClose}>
    <div className="mt-3 min-h-0 overflow-y-auto overscroll-contain">
      <ZoneOverlayImage src={preview.src} maskSrc={preview.maskSrc} alt={preview.label} className="mx-auto max-h-[75dvh] max-w-full object-contain" />
    </div>
  </EditorDesignDialogFrame>;
}
