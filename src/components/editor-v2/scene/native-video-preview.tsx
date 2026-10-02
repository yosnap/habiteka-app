'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
export function NativeVideoPreview({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className="rounded border px-3 py-2 text-sm">Ver último vídeo exportado</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/60" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-[151] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-4 text-ink shadow-2xl">
        <header className="mb-3 flex items-start justify-between gap-4">
          <div><Dialog.Title className="font-semibold">Vídeo nativo exportado</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">Revisa la obra, la cubierta, las cotas y el sonido. Esta previsualización se conserva mientras esté abierta la escena.</Dialog.Description></div>
          <Dialog.Close className="rounded border px-3 py-2 text-sm">Cerrar</Dialog.Close>
        </header>
        <video src={url} controls playsInline preload="metadata" className="max-h-[72vh] w-full rounded-lg bg-black" />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
