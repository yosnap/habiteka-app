'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import { VIDEO_FORMATS } from '@/lib/editor-document/video-format';
import { ADVERTISING_DIMENSIONS, type AdvertisingVideoOptions } from '@/lib/editor-document/advertising-video';

export function AdvertisingControls({ value, onChange, disabled, portalContainer }: {
  value: AdvertisingVideoOptions; onChange: (value: AdvertisingVideoOptions) => void; disabled?: boolean; portalContainer?: HTMLElement | null;
}) {
  return <fieldset disabled={disabled} className="grid gap-3 rounded-control border border-line p-3 sm:grid-cols-2">
    <legend className="px-1 text-sm font-medium">Formato del anuncio</legend>
    <label className="text-sm">Formato<ModernSelect aria-label="Formato del anuncio" value={value.format} portalContainer={portalContainer} popoverZIndex={150}
      onChange={event => onChange({ ...value, format: event.target.value as AdvertisingVideoOptions['format'] })} className="mt-1 w-full">
      {VIDEO_FORMATS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
    </ModernSelect></label>
    <label className="text-sm">Medidas<ModernSelect aria-label="Medidas del anuncio" value={value.dimensionMode} portalContainer={portalContainer} popoverZIndex={150}
      onChange={event => onChange({ ...value, dimensionMode: event.target.value as AdvertisingVideoOptions['dimensionMode'] })} className="mt-1 w-full">
      {ADVERTISING_DIMENSIONS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
    </ModernSelect></label>
    <p className="text-xs text-ink-soft sm:col-span-2">Vertical conserva la imagen completa con márgenes. Las medidas globales del diseño aprobado aparecen en un panel separado; no siguen la cámara del clip. «Solo al inicio» dura cuatro segundos.</p>
  </fieldset>;
}
