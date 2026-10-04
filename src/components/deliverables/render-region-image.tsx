'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { CanvasZone, NormalizedBBox, NormalizedPoint } from '@/lib/contracts';
import { boxBetween, containedImageRect, nudgeImageRegion } from '@/lib/image-region-selection';
import { LegalSeal } from './legal-seal';
import styles from './render-image-dialog.module.css';

/** La selección usa el rectángulo visible de la imagen, nunca sus márgenes. */
export function RenderRegionImage({ url, label, active, disabled, zone, onZone }: {
  url: string; label: string; active: boolean; disabled: boolean;
  zone: CanvasZone | null; onZone: (zone: CanvasZone | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ pointerId: number; start: NormalizedPoint } | null>(null);
  const [frame, setFrame] = useState<ReturnType<typeof containedImageRect>>(null);
  const [draft, setDraft] = useState<NormalizedBBox | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setFrame(containedImageRect(element.getBoundingClientRect(), {
      width: image.current?.naturalWidth ?? 0, height: image.current?.naturalHeight ?? 0,
    }));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const img = image.current;
    img?.addEventListener('load', measure);
    measure();
    return () => { observer.disconnect(); img?.removeEventListener('load', measure); };
  }, [url]);
  const point = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  const selected = draft ?? zone?.bbox;
  const setBox = (bbox: NormalizedBBox) => onZone({ id: 'image-region', bbox });
  return <div ref={container} className={styles.image}>
    {/* eslint-disable-next-line @next/next/no-img-element -- URL de storage firmada */}
    <img ref={image} src={url} alt={label} draggable={false} />
    {active && frame && <button type="button" data-image-zone-editor
      aria-label="Seleccionar zona de retoque" aria-describedby="image-region-help" disabled={disabled}
      className={styles.regionSurface} style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      onPointerDown={event => {
        if (event.button !== 0 || disabled) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, start: point(event) };
        setDraft(boxBetween(drag.current.start, drag.current.start));
      }}
      onPointerMove={event => { if (drag.current?.pointerId === event.pointerId) setDraft(boxBetween(drag.current.start, point(event))); }}
      onPointerUp={event => {
        if (drag.current?.pointerId !== event.pointerId) return;
        const next = boxBetween(drag.current.start, point(event));
        drag.current = null; setDraft(null); event.currentTarget.releasePointerCapture(event.pointerId);
        if (next.width * frame.width >= 3 && next.height * frame.height >= 3) setBox(next);
      }}
      onPointerCancel={() => { drag.current = null; setDraft(null); }}
      onKeyDown={event => {
        if (event.key.startsWith('Arrow')) {
          event.preventDefault(); event.stopPropagation();
          setBox(nudgeImageRegion(zone?.bbox ?? { x: .4, y: .4, width: .2, height: .2 }, event.key, event.shiftKey));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation(); setBox(zone?.bbox ?? { x: .4, y: .4, width: .2, height: .2 });
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault(); event.stopPropagation(); onZone(null);
        }
      }}>
      {selected && <span className={styles.regionBox} style={{ left: `${selected.x * 100}%`, top: `${selected.y * 100}%`,
        width: `${selected.width * 100}%`, height: `${selected.height * 100}%` }} />}
    </button>}
    <LegalSeal />
  </div>;
}
