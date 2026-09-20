'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import { RENDER_VIEW_LABELS, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';

export type PreviewRender = (options: Pick<RenderDesignOptions, 'lighting' | 'views'>) => Promise<RenderCapture>;

export function RenderLivePreview({ capture, lighting, view, onPreview, onExpand }: {
  capture?: RenderCapture;
  lighting: RenderDesignOptions['lighting'];
  view: RenderDesignOptions['views'][number];
  onPreview?: PreviewRender;
  onExpand: (src: string, label: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; capture?: RenderCapture; error?: string }>();
  const key = `${lighting}:${view}`;
  useEffect(() => {
    if (!onPreview) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void onPreview({ lighting, views: [view] }).then(
        (capture) => { if (!cancelled) setResult({ key: `${lighting}:${view}`, capture }); },
        (cause) => { if (!cancelled) setResult({ key: `${lighting}:${view}`, error: cause instanceof Error ? cause.message : 'No se pudo actualizar la vista.' }); },
      );
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [lighting, view, onPreview]);
  const current = result?.capture ?? capture;
  const pending = Boolean(onPreview && result?.key !== key);
  const label = `${RENDER_VIEW_LABELS[view]} · ${lighting === 'daylight' ? 'Día' : lighting === 'warm' ? 'Atardecer' : 'Noche'}`;
  return <figure className="mt-3 overflow-hidden rounded-card border border-line" aria-busy={pending}>
    <button type="button" className="relative block w-full cursor-zoom-in" disabled={!current || pending || Boolean(result?.error)}
      aria-label="Ampliar previsualización" onClick={() => current && onExpand(current.dataUrl, label)}>
      {current && <img src={current.dataUrl} alt="Previsualización de iluminación y encuadre" className="w-full object-contain" />}
      {pending && <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/50 text-sm"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Actualizando iluminación…</span>}
    </button>
    <figcaption className="text-ink-soft px-3 py-2 text-xs" role="status">
      {result?.key === key && result.error ? result.error : pending ? 'Preparando previsualización local…' : `${label} · Vista previa sin coste · Pulsa para ampliar`}
    </figcaption>
  </figure>;
}
