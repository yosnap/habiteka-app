'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DeliverableView } from './deliverables-panel';
import { setRenderAcceptance } from '@/server/walkthrough/render-acceptance-actions';
import { acceptedRenderIssue, renderReviewIssue } from '@/lib/editor-document/render-review';

export function RenderAcceptance({ item, projectId, saved, onChanged }: { item: DeliverableView; projectId: string;
  saved?: { accepted: boolean; version: number }; onChanged: (value: { accepted: boolean; version: number }) => void }) {
  const generation = item.payload.type === 'render3d' ? item.payload.generation : undefined;
  const [accepted, setAccepted] = useState(saved?.accepted ?? acceptedRenderIssue(generation) === null);
  const [version, setVersion] = useState(saved?.version ?? item.version);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const issue = renderReviewIssue(generation);
  if (!generation?.provider || generation.provider === 'native') return <p className="text-xs text-ink-soft">Captura del plano guía: no se admite como diseño para vídeos o visitas.</p>;
  async function change() {
    setBusy(true); setError('');
    try {
      const result = await setRenderAcceptance({ projectId, zoneId: item.zoneId ?? null }, item.id, version, !accepted);
      setAccepted(result.accepted); setVersion(result.version);
      onChanged(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la aceptación.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-control border border-line p-3">
    <p className="text-sm">{accepted ? 'Diseño aceptado para vídeos y visitas.' : 'Revisa distribución, muebles, acabados y realismo. Solo los diseños que aceptes se podrán usar en vídeos y visitas.'}</p>
    <Button variant={accepted ? 'outline' : 'default'} disabled={busy || (!accepted && Boolean(issue))} onClick={() => void change()}>{busy ? 'Guardando…' : accepted ? 'Retirar aceptación' : 'Aceptar este diseño'}</Button>
    {issue && <p className="text-xs text-ink-soft">{issue}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
