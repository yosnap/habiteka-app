'use client';
import { constructionTiming, type ConstructionDurationSeconds } from '@/lib/editor-document/construction-timing';
import type { VideoPresentationOptions } from '@/lib/editor-document/video-presentation';

export function VideoDurationControls({ value, onChange, combined }: {
  value: VideoPresentationOptions; onChange: (value: VideoPresentationOptions) => void; combined: boolean;
}) {
  const timing = constructionTiming(value);
  return <div className="space-y-2">
    <label className="block text-sm">{combined ? 'Duración de la construcción' : 'Duración del vídeo'}
      <select aria-label="Duración de la construcción" value={timing.durationMs / 1000}
        className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2"
        onChange={event => onChange({ ...value, constructionDurationSeconds: Number(event.target.value) as ConstructionDurationSeconds })}>
        <option value={8}>8 s · construcción rápida</option>
        <option value={12}>12 s · más tiempo para los muebles</option>
      </select>
    </label>
    <p className="text-xs text-ink-soft">Paredes una a una en 3 s; después tejado, muebles y vuelo final.{combined ? ' La visita se añade después.' : ''}</p>
  </div>;
}
