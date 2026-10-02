'use client';
import { useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { ROOF_KIND_LABELS, setExteriorRoof, type ExteriorRoof } from '@/lib/editor-document/exterior-roof';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { ModernSelect } from '@/components/ui/modern-select';
import { House } from 'lucide-react';
import { SurfaceMaterialPicker } from './surface-material-picker';
import { SiteAdjustmentControl } from './site-adjustment-control';

export function ExteriorRoofPanel({ store, onPreview }: { store: EditorStore; onPreview: () => void }) {
  const doc = useStore(store, state => state.document), readOnly = useStore(store, state => state.readOnly);
  const [open, setOpen] = useState(false), [notice, setNotice] = useState('');
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null);
  const geometry = useMemo(() => {
    try {
      const rooms = eligibleCeilingRooms(doc);
      try { return { rooms, parts: exteriorRoofGeometry(doc), error: '' }; }
      catch (error) { return { rooms, parts: [], error: error instanceof Error ? error.message : 'Revisa el tejado.' }; }
    }
    catch (error) { return { rooms: [], parts: [], error: error instanceof Error ? error.message : 'Revisa el plano.' }; }
  }, [doc]);
  const roof = doc.exteriorRoof;
  function update(patch: Partial<ExteriorRoof> | null) {
    setNotice('');
    try { store.getState().apply(setExteriorRoof(store.getState().document, patch)); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo guardar el tejado.'); }
  }
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" data-project-menu-action><House size={18} />Tejado</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50" />
      <Dialog.Content ref={setMenuContainer} onInteractOutside={event => event.preventDefault()}
        className="bg-surface text-ink fixed top-1/2 left-1/2 z-[151] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
        <header className="flex justify-between gap-4 border-b p-5">
          <div><Dialog.Title className="text-lg font-semibold">Tejado exterior</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">Configura la cubierta de esta planta. Se guarda con el diseño y aparece en las vistas exteriores y el vídeo.</Dialog.Description></div>
          <Dialog.Close className="self-start rounded-lg border px-3 py-2 text-sm">Cerrar</Dialog.Close>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <p className="text-sm">El techo y el falso techo interiores siguen en «Techo y luces». El tejado exterior tiene su propia forma y pendiente. En edificios con varias plantas, sitúate en la planta que deba cubrir.</p>
          {!geometry.rooms.length ? <p role="status">No hay habitaciones interiores cerradas en esta planta. Revisa sus muros y etiquetas; patios y terrazas no se cubren automáticamente.</p>
            : !roof ? <button type="button" className="rounded-lg bg-brand-600 px-4 py-3 font-medium text-white" disabled={readOnly} onClick={() => update({})}>Añadir tejado a las estancias interiores</button>
            : <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-4">
                <label className="block space-y-1 text-sm"><span>Tipo de tejado</span><ModernSelect portalContainer={menuContainer} popoverZIndex={200} value={roof.kind}
                  onChange={event => update({ kind: event.target.value as ExteriorRoof['kind'], pitchDeg: Math.max(2, roof.pitchDeg) })}>
                  {Object.entries(ROOF_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </ModernSelect></label>
                {roof.kind !== 'flat' && <><SiteAdjustmentControl label="Pendiente del tejado" value={roof.pitchDeg} min={2} max={60} step={1} unit="°" disabled={readOnly} onChange={pitchDeg => update({ pitchDeg })} />
                  <SiteAdjustmentControl label="Orientación de la pendiente o cumbrera" value={roof.orientationDeg} min={0} max={360} step={1} unit="°" disabled={readOnly} onChange={orientationDeg => update({ orientationDeg })} /></>}
                <SiteAdjustmentControl label="Alero" value={roof.eavesMm / 10} min={0} max={100} step={1} unit="cm" disabled={readOnly} onChange={value => update({ eavesMm: value * 10 })} />
                <SiteAdjustmentControl label="Espesor del tejado" value={roof.thicknessMm / 10} min={8} max={50} step={1} unit="cm" disabled={readOnly} onChange={value => update({ thicknessMm: value * 10 })} />
                <label className="flex items-center justify-between text-sm">Color del tejado<input type="color" aria-label="Color del tejado" value={roof.color} onChange={event => update({ color: event.target.value })} /></label>
                <SurfaceMaterialPicker label="Material del tejado" value={roof.materialId} onChange={value => update({ materialId: value ?? undefined })} />
              </div>
              <div className="space-y-3 text-sm">
                <h3 className="font-semibold">Habitaciones que cubre</h3>
                {roof.roomIds.some(id => !geometry.rooms.some(room => room.id === id)) && <button type="button" className="underline" onClick={() => update({ roomIds: geometry.rooms.map(room => room.id) })}>Actualizar selección con las habitaciones actuales</button>}
                <p className="text-xs text-ink-soft">Se unen sus huellas; se respetan retranqueos y huecos. Desmarca las partes que deban quedar abiertas.</p>
                {geometry.rooms.map((room, index) => <label key={room.id} className="flex items-start gap-2 rounded-lg border p-2">
                  <input type="checkbox" className="mt-1" checked={roof.roomIds.includes(room.id)} onChange={event => update({ roomIds: event.target.checked ? [...roof.roomIds, room.id] : roof.roomIds.filter(id => id !== room.id) })} />
                  <span>{doc.labels.find(label => insideRoom(label, room.boundary))?.text ?? `Estancia ${index + 1}`} · {(room.areaMm2 / 1e6).toFixed(1)} m²</span>
                </label>)}
                {!!geometry.parts.length && <p>Altura máxima del tejado en esta planta: {Math.max(...geometry.parts.map(part => part.peakM)).toFixed(2)} m.</p>}
                <button type="button" className="text-red-700 underline underline-offset-4" onClick={() => update(null)}>Quitar tejado exterior</button>
              </div>
            </fieldset>}
          {(notice || geometry.error) && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">{notice || geometry.error}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-5 text-sm">
          <p className="text-ink-soft">Los ajustes se guardan en el borrador. Aprueba los cambios antes de exportar.</p>
          <button type="button" disabled={!roof || !!geometry.error} className="rounded-lg border px-4 py-2 font-medium" onClick={() => { setOpen(false); onPreview(); }}>Ver tejado en 3D</button>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
