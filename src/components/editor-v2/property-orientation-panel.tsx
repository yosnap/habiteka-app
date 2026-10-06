'use client';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Compass } from 'lucide-react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { LIGHTING_LABELS, type LightingPreset } from '@/lib/lighting-preset';
import { propertyNorth, propertySun, setPropertyOrientation, SUN_DEFAULTS, type SolarPreset } from '@/lib/editor-document/property-orientation';
import { SiteAdjustmentControl } from './site-adjustment-control';
import { PropertyCompass } from './property-compass';

export function PropertyOrientationPanel({ store, lighting, onLightingChange }: {
  store: EditorStore; lighting: LightingPreset; onLightingChange: (lighting: LightingPreset) => void;
}) {
  const doc = useStore(store, state => state.document), readOnly = useStore(store, state => state.readOnly);
  const [notice, setNotice] = useState('');
  const north = propertyNorth(doc), preset: SolarPreset = lighting === 'evening' ? 'daylight' : lighting;
  const sun = propertySun(doc, preset) ?? SUN_DEFAULTS[preset];
  function update(patch: Parameters<typeof setPropertyOrientation>[1]) {
    try { store.getState().apply(setPropertyOrientation(store.getState().document, patch)); setNotice(''); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo guardar la orientación.'); }
  }
  function updateSun(patch: Partial<typeof sun>) {
    const current = store.getState().document;
    update({ sunlight: { ...current.propertyOrientation?.sunlight, [preset]: { ...sun, ...patch } } });
  }
  return <Dialog.Root>
    <Dialog.Trigger asChild><button type="button" data-project-menu-action><Compass size={18} />Orientación y sol</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50" />
      <Dialog.Content onInteractOutside={event => event.preventDefault()}
        className="bg-surface text-ink fixed top-1/2 left-1/2 z-[151] max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div><Dialog.Title className="text-lg font-semibold">Orientación del inmueble y sol</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">Indica dónde está el norte respecto al plano y de dónde llega el sol. Se guarda para todo el edificio.</Dialog.Description></div>
          <Dialog.Close className="rounded-lg border px-3 py-2 text-sm">Cerrar</Dialog.Close>
        </header>
        <fieldset disabled={readOnly} className="mt-5 space-y-5">
          <div className="flex items-center gap-4"><PropertyCompass northDeg={north ?? 0} />
            <p className="text-sm">0°: norte arriba. 90°: derecha. 180°: abajo. 270°: izquierda. Cambiar el norte no gira los muros del plano.</p></div>
          {north === undefined && <><p className="text-sm">Este inmueble aún no tiene orientación definida; sus sombras actuales son de presentación.</p>
            <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => update({ northDeg: 0 })}>Definir norte arriba</button></>}
          <SiteAdjustmentControl label="Norte del plano" value={north ?? 0} min={0} max={360} step={1} unit="°" onChange={northDeg => update({ northDeg })} />
          {doc.geographicSite && <p className="text-sm text-ink-soft">El norte sigue el giro de Parcela real. Cambiarlo aquí cambia ese encaje; tendrás que volver a confirmarlo en Parcela real.</p>}
          <div><p className="mb-2 text-sm font-medium">Ambiente de luz</p><div className="flex flex-wrap gap-2">
            {Object.entries(LIGHTING_LABELS).map(([value, label]) => <button key={value} type="button" aria-pressed={lighting === value}
              className={`rounded-lg border px-3 py-2 text-sm ${lighting === value ? 'bg-brand-600 text-white' : ''}`}
              onClick={() => onLightingChange(value as LightingPreset)}>{label}</button>)}
          </div></div>
          {lighting === 'evening' ? <p className="text-sm">De noche no hay sol. Las sombras proceden de las luminarias del inmueble.</p> : <>
            <SiteAdjustmentControl label="Dirección de donde llega el sol" value={sun.azimuthDeg} min={0} max={360} step={1} unit="°" onChange={azimuthDeg => updateSun({ azimuthDeg })} />
            <p className="text-xs text-ink-soft">0° Norte · 90° Este · 180° Sur · 270° Oeste. Las sombras se proyectan hacia el lado contrario.</p>
            <SiteAdjustmentControl label="Altura del sol sobre el horizonte" value={sun.elevationDeg} min={1} max={90} step={1} unit="°" onChange={elevationDeg => updateSun({ elevationDeg })} />
            <p className="text-xs text-ink-soft">Un sol bajo produce sombras más largas. Día, Tarde y Atardecer conservan sus ajustes por separado.</p>
          </>}
          <p className="text-sm text-ink-soft">La dirección y altura se ajustan manualmente. No se calculan a partir de ubicación, fecha y hora. Los cambios se ven en la maqueta y guían las imágenes nuevas; revisa sus sombras antes de aceptar el diseño.</p>
        </fieldset>
        {notice && <p role="alert" className="mt-3 text-sm">{notice}</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
