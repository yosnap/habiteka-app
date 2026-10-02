'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import { RENDER_VIEW_LABELS, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { ZoneOverlayImage } from './zone-overlay-image';

export type PreviewRender = (options: RenderDesignOptions) => Promise<RenderCapture>;

export function RenderLivePreview({ capture, lighting, view, options, onPreview, onExpand }: {
  capture?: RenderCapture;
  lighting: RenderDesignOptions['lighting']; view: RenderDesignOptions['views'][number];
  options: RenderDesignOptions;
  onPreview?: PreviewRender;
  onExpand: (src: string, label: string, maskSrc?: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; capture?: RenderCapture; error?: string }>();
  const key = `${lighting}:${view}:${options.placement}:${options.freedom}:${options.designScope}:${options.designZoneId}:${JSON.stringify(options.regions)}`;
  useEffect(() => {
    if (!onPreview) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void onPreview({ ...options, views: [view] }).then(
        (capture) => { if (!cancelled) setResult({ key, capture }); },
        (cause) => { if (!cancelled) setResult({ key, error: cause instanceof Error ? cause.message : 'No se pudo actualizar la vista.' }); },
      );
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, onPreview, options, view]);
  const current = result?.capture ?? capture;
  const pending = Boolean(onPreview && result?.key !== key);
  const label = `${RENDER_VIEW_LABELS[view]} · ${lighting === 'daylight' ? 'Día' : lighting === 'afternoon' ? 'Tarde' : lighting === 'warm' ? 'Atardecer' : 'Noche'}`;
  return <figure className="mt-3 overflow-hidden rounded-card border border-line" aria-busy={pending}>
    <button type="button" className="relative block w-full cursor-zoom-in" disabled={!current || pending || Boolean(result?.error)}
      aria-label="Ampliar previsualización" onClick={() => current && onExpand(current.dataUrl, label, current.maskDataUrl)}>
      {current && <ZoneOverlayImage src={current.dataUrl} maskSrc={current.maskDataUrl}
        alt="Previsualización de iluminación y encuadre" className="w-full object-contain" />}
      {pending && <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/50 text-sm"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Actualizando iluminación…</span>}
    </button>
    <figcaption className="text-ink-soft px-3 py-2 text-xs" role="status">
      {result?.key === key && result.error ? result.error : pending ? 'Preparando previsualización local…' : `${label} · Vista previa sin coste · Pulsa para ampliar`}
    </figcaption>
  </figure>;
}
