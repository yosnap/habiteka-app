'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { DeliverableView } from './deliverables-panel';
import { setRenderAcceptance } from '@/server/walkthrough/render-acceptance-actions';
import { renderGalleryState, type RenderAcceptanceSnapshot } from '@/lib/editor-document/render-gallery-state';
import { RenderStatusBadge } from './render-status-badge';

export function RenderAcceptance({ item, projectId, saved, onChanged }: { item: DeliverableView; projectId: string;
  saved?: RenderAcceptanceSnapshot; onChanged: (value: RenderAcceptanceSnapshot) => void }) {
  const { accepted, acceptedAt, version, issue, sourceIsAI, status } = renderGalleryState(item, saved);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!sourceIsAI) return <div className="space-y-2"><RenderStatusBadge status="reference" />
    <p className="text-xs text-ink-soft">No consta un origen IA válido. Esta imagen no se admite como diseño para vídeos o visitas.</p></div>;
  async function change() {
    setBusy(true); setError('');
    try {
      const result = await setRenderAcceptance({ projectId, zoneId: item.zoneId ?? null }, item.id, version, !accepted);
      onChanged(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la aceptación.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-control border border-line p-3" aria-busy={busy}>
    <div aria-live="polite"><RenderStatusBadge status={status} /></div>
    <p className="text-sm">{issue ? 'Esta imagen está descartada y no puede usarse en vídeos o visitas.'
      : accepted ? 'Has aceptado este diseño. Los vídeos requieren además referencias compatibles entre sí.'
        : 'Comprueba arquitectura, muebles, acabados y realismo antes de aceptar. La auditoría automática no sustituye tu revisión.'}</p>
    {acceptedAt && Number.isFinite(Date.parse(acceptedAt)) && <p className="text-xs text-ink-soft">Aceptación registrada: <time dateTime={acceptedAt}>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(acceptedAt))} UTC</time>.</p>}
    <Button type="button" className="w-full" variant={accepted ? 'outline' : 'default'} disabled={busy || (!accepted && Boolean(issue))} onClick={() => void change()}>{busy ? 'Guardando…' : accepted ? 'Retirar aceptación' : 'Aceptar este diseño'}</Button>
    {!accepted && !issue && <p className="text-xs text-ink-soft">Aceptar no genera imágenes ni consume créditos.</p>}
    {accepted && !issue && <Link className="inline-block text-sm font-medium text-brand-700 underline" href={`/projects/${encodeURIComponent(projectId)}/videos${item.zoneId ? `?zona=${encodeURIComponent(item.zoneId)}` : ''}`}>Preparar vídeo con mis diseños</Link>}
    {issue && <p className="text-xs text-ink-soft">{issue}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
