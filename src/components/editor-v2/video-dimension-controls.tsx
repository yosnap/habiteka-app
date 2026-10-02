'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import { VIDEO_DIMENSION_MODES, videoDimensionMode, type VideoDimensionMode, type VideoPresentationOptions } from '@/lib/editor-document/video-presentation';

export function VideoDimensionControls({ value, onChange, disabled = false, portalContainer }: {
  value: VideoPresentationOptions; onChange: (value: VideoPresentationOptions) => void; disabled?: boolean; portalContainer?: HTMLElement | null;
}) {
  const mode = videoDimensionMode(value), item = VIDEO_DIMENSION_MODES.find(item => item.value === mode)!;
  return <div className="space-y-2">
    <label className="block text-sm">Medidas del edificio
      <ModernSelect aria-label="Presentación de las cotas" value={mode} disabled={disabled} portalContainer={portalContainer} popoverZIndex={150}
        className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2"
        onChange={event => onChange({ ...value, showDimensions: event.target.value !== 'none', dimensionMode: event.target.value as VideoDimensionMode })}>
        {VIDEO_DIMENSION_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </ModernSelect>
    </label>
    <p className="text-xs text-ink-soft">{item.description}</p>
    {mode !== 'none' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled}
      checked={value.dimensionOcclusion !== false} onChange={event => onChange({ ...value, dimensionOcclusion: event.target.checked })} />Ocultar detrás de la casa</label>}
  </div>;
}
