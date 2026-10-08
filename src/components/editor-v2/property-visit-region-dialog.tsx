'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import type { CanvasZone } from '@/lib/contracts';
import type { VisitRegionEdit } from '@/server/walkthrough/property-visit-region';
import { RenderRegionImage } from '@/components/deliverables/render-region-image';
import { Button } from '@/components/ui/button';
import styles from '@/components/deliverables/render-image-dialog.module.css';

export function PropertyVisitRegionDialog({ source, price, busy, onClose, onGenerate }: {
  source: { id: string; url: string; reason: string }; price: number; busy: boolean;
  onClose: () => void; onGenerate: (edit: VisitRegionEdit) => Promise<void>;
}) {
  const [zone, setZone] = useState<CanvasZone | null>(null), [instruction, setInstruction] = useState(source.reason);
  const [eraseZone, setEraseZone] = useState(false), [consent, setConsent] = useState(false);
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/60" />
    <Dialog.Content className={styles.dialog} onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="flex justify-between gap-3 p-4"><div>
        <Dialog.Title>Corregir una zona del encuadre</Dialog.Title>
        <Dialog.Description>Arrastra sobre el defecto. El resto de la imagen se conserva. El resultado se revisará de nuevo y necesitará tu aceptación.</Dialog.Description>
      </div><Button variant="outline" disabled={busy} onClick={onClose}>Cerrar retoque</Button></header>
      <RenderRegionImage url={source.url} label="Borrador del paseo para corregir" active disabled={busy} zone={zone} onZone={setZone} />
      <div className="grid shrink-0 gap-2 p-4 text-sm">
        <p id="image-region-help">Selecciona como máximo la mitad de la imagen. Teclado: Enter selecciona el centro, flechas mueven y Mayús + flechas ajustan el tamaño.</p>
        <label>Corrección de la zona<textarea className="block w-full rounded border p-2" rows={3} maxLength={2500} disabled={busy}
          value={instruction} onChange={event => { setInstruction(event.target.value); setConsent(false); }} /></label>
        <label><input type="checkbox" checked={eraseZone} disabled={busy} onChange={event => setEraseZone(event.target.checked)} /> Borrar el contenido inventado antes de reconstruir el fondo</label>
        <label><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /> Autorizo un retoque ({price.toFixed(2)} USD) y sus análisis visuales adicionales.</label>
        <Button disabled={busy || !consent || !zone || instruction.trim().length < 10} onClick={() => {
          if (!zone) return; setConsent(false); void onGenerate({ sourceId: source.id, zone, instruction, eraseZone });
        }}>{busy ? 'Corrigiendo zona…' : 'Generar corrección de la zona'}</Button>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
