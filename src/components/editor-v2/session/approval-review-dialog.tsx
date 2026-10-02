'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { ModernSelect } from '@/components/ui/modern-select';
import { LIGHTING_LABELS, LIGHTING_PRESETS } from '@/lib/lighting-preset';
import type { ApprovedLightingPreset } from '@/lib/editor-document/approved-design';

export function ApprovalReviewDialog({ open, pending, error, lighting, onLightingChange, onClose, onConfirm, confirmDisabled = false }: {
  open: boolean; pending: boolean; error: string | null; lighting: ApprovedLightingPreset;
  confirmDisabled?: boolean;
  onLightingChange: (value: ApprovedLightingPreset) => void; onClose: () => void; onConfirm: () => void;
}) {
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !pending) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50" />
      <Dialog.Content ref={setMenuContainer} onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
        className="bg-surface text-ink fixed top-1/2 left-1/2 z-[151] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border p-6 shadow-2xl">
        <Dialog.Title className="text-lg font-semibold">Revisar y aprobar diseño</Dialog.Title>
        <Dialog.Description className="text-ink-soft text-sm">Se conservará la revisión actual con el diseño, la ubicación y la luz elegida. Los cambios posteriores seguirán en el borrador. Esta aprobación no genera imágenes ni vídeos.</Dialog.Description>
        <label className="block space-y-2 text-sm"><span>Luz de la versión aprobada</span>
          <ModernSelect portalContainer={menuContainer} popoverZIndex={200} value={lighting} disabled={pending}
            onChange={event => onLightingChange(event.target.value as ApprovedLightingPreset)}>
            {LIGHTING_PRESETS.map(value => <option key={value} value={value}>{LIGHTING_LABELS[value]}</option>)}
          </ModernSelect>
        </label>
        {error && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="cursor-pointer rounded-lg border px-4 py-2 text-sm disabled:opacity-50" disabled={pending} onClick={onClose}>Cancelar</button>
          <button type="button" className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={pending || confirmDisabled} onClick={onConfirm}>
            {pending ? 'Aprobando…' : 'Confirmar aprobación'}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
