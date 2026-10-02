'use client';
import { useState } from 'react';
import type { RenderCapture } from '@/lib/editor-document/render-view';

/** Reaudita bytes existentes sin solicitar otra imagen al proveedor. */
export function ExistingRenderReview({ captures, disabled, labelAt, onReview }: {
  captures: RenderCapture[]; disabled: boolean; labelAt: (index: number) => string;
  onReview: (index: number, dataUrl: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0), [dataUrl, setDataUrl] = useState(''), [error, setError] = useState('');
  return <section className="mt-4 space-y-3 rounded-control border border-line p-3">
    <h3 className="text-sm font-semibold">Revisar una imagen ya generada</h3>
    <p className="text-xs text-ink-soft">Elige el PNG y su vista de referencia. Solo se guarda si pasa la revisión. La revisión visual con IA tiene coste; no se genera otra imagen.</p>
    <div className="flex flex-wrap gap-2">{captures.map((capture, i) => <button key={`${capture.view.preset}-${i}`} type="button" disabled={disabled} aria-pressed={index === i}
      className="rounded-control border border-line px-3 py-2 text-xs aria-pressed:bg-brand-50" onClick={() => setIndex(i)}>{labelAt(i)}</button>)}</div>
    <label className="block text-xs">Imagen PNG existente<input aria-label="Imagen PNG existente para revisión" type="file" accept="image/png" disabled={disabled} className="mt-2 block w-full text-xs"
      onChange={event => {
        setDataUrl(''); setError(''); const file = event.target.files?.[0]; if (!file) return;
        if (file.type !== 'image/png' || file.size > 10_000_000) { setError('Elige un PNG de hasta 10 MB.'); return; }
        const reader = new FileReader(); reader.onload = () => setDataUrl(String(reader.result));
        reader.onerror = () => setError('No se pudo leer la imagen.'); reader.readAsDataURL(file);
      }} /></label>
    <button type="button" disabled={disabled || !dataUrl || !captures[index]} className="rounded-control border border-line px-3 py-2 text-sm disabled:opacity-50"
      onClick={() => { setError(''); void onReview(index, dataUrl).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo revisar la imagen.')); }}>Revisar y guardar imagen existente</button>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
  </section>;
}
