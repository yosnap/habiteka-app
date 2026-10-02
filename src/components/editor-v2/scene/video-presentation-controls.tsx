'use client';
import type { VideoPresentationOptions } from './construction-audio';
import { VideoDimensionControls } from '../video-dimension-controls';

export function VideoPresentationControls({ value, onChange, disabled }: {
  value: VideoPresentationOptions; onChange: (value: VideoPresentationOptions) => void; disabled: boolean;
}) {
  return <details className="rounded-lg border bg-surface p-2 text-xs" aria-label="Presentación del vídeo">
    <summary className="cursor-pointer font-medium">Sonido y cotas del vídeo</summary>
    <div className="mt-2 space-y-2">
      <label className="flex gap-2"><input type="checkbox" checked={value.soundEffects} disabled={disabled}
        onChange={event => onChange({ ...value, soundEffects: event.target.checked })} />Efectos de construcción</label>
      <label className="block">Volumen · {Math.round(value.soundVolume * 100)} %<input aria-label="Volumen de efectos de construcción" type="range" min="0" max="100" step="5"
        className="block w-full" disabled={disabled || !value.soundEffects} value={value.soundVolume * 100}
        onChange={event => onChange({ ...value, soundVolume: Number(event.target.value) / 100 })} /></label>
      <VideoDimensionControls value={value} onChange={onChange} disabled={disabled} />
      <p className="text-ink-soft">Efectos sintetizados para las etapas de obra. Las cotas proceden del plano.</p>
    </div>
  </details>;
}
