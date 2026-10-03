'use client';
import { useState } from 'react';
import type { EditorScope } from '@/server/editor/authority';
import type { DesignVideoJob } from '@/lib/editor-document/design-video';
import { startDesignConstruction, checkDesignConstruction, reviewDesignConstruction, discardDesignPreparation } from '@/server/walkthrough/design-video-actions';
import { Button } from '@/components/ui/button';
import { RenameVideo } from '@/components/deliverables/video-name';

export const DESIGN_VIDEO_STATUS = { prepared: 'Prueba preparada', submitting: 'Envío en curso; no repetir', generating: 'H3 está generando',
  review: 'Pendiente de revisar', accepted: 'Prueba aceptada', rejected: 'Prueba rechazada', failed: 'Prueba fallida', unknown: 'Envío sin confirmar; no repetir' };

export function DesignVideoTask({ scope, id, initial, initialUrl, onChange, onBusyChange, onEdit, onRenamed, onOpenSaved, onCreateAdvertising }: {
  scope: EditorScope; id: string; initial: DesignVideoJob; initialUrl?: string | null;
  onChange?: (job: DesignVideoJob) => void; onBusyChange?: (busy: boolean) => void;
  onEdit?: () => void;
  onRenamed?: () => void;
  onOpenSaved?: () => void; onCreateAdvertising?: () => void;
}) {
  const [job, setJob] = useState(initial), [url, setUrl] = useState(initialUrl ?? null);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const visit = job.mode === 'walkthrough-ai';
  const update = (next: DesignVideoJob) => { setJob(next); onChange?.(next); };
  async function act(operation: () => Promise<void>) {
    setBusy(true); onBusyChange?.(true); setError('');
    try { await operation(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la prueba.');
      const current = await checkDesignConstruction(scope, id).catch(() => null);
      if (current) { update(current.job); setUrl(current.url); }
    } finally { setBusy(false); onBusyChange?.(false); }
  }
  return <section className="space-y-3 rounded-control border border-line p-4">
    <h3 className="font-semibold">{job.title || DESIGN_VIDEO_STATUS[job.status]}</h3>
    <p className="text-xs text-ink-soft">{visit ? 'Primera persona desde diseños · toma de una estancia' : 'Construcción desde diseños'} · piloto H3</p>
    {job.title && <p className="text-sm text-ink-soft">{DESIGN_VIDEO_STATUS[job.status]}</p>}
    {!busy && !['submitting', 'generating', 'unknown'].includes(job.status) && <RenameVideo scope={scope} id={id} title={job.title ?? null} onBusyChange={onBusyChange} onSaved={() => {
      void checkDesignConstruction(scope, id).then(current => update(current.job)); onRenamed?.();
    }} />}
    <p className="text-sm text-ink-soft">{job.durationMs / 1000} s · {job.settings.resolution} · {job.sourceIds.length} imágenes · coste previsto ${job.estimateUsd.toFixed(2)} · {job.credits} créditos Habiteka</p>
    <p className="text-sm"><strong>Ámbito de los diseños:</strong> {job.includedZones.length ? job.includedZones.join(', ') : 'Todo el ámbito visible en las referencias elegidas.'}</p>
    <details><summary className="cursor-pointer text-sm">Guion preparado</summary><p className="mt-2 whitespace-pre-wrap text-xs text-ink-soft">{job.prompt}</p></details>
    {job.status === 'prepared' && <>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
        Autorizo enviar estas {job.sourceIds.length} imágenes del diseño a KIE/MiniMax, incluida la parcela si aparece en ellas, y generar una sola prueba por ${job.estimateUsd.toFixed(2)} previstos.</label>
      <Button disabled={busy || !consent} onClick={() => void act(async () => {
        const result = await startDesignConstruction(scope, id, { referencesToKie: true, maxUsd: job.estimateUsd }); update({ ...job, ...result });
      })}>{busy ? 'Enviando la prueba…' : `Generar prueba H3 · $${job.estimateUsd.toFixed(2)}`}</Button>
      {onEdit && <Button variant="outline" className="ml-2" disabled={busy} onClick={() => void act(async () => {
        await discardDesignPreparation(scope, id); onEdit();
      })}>Modificar selección y guion</Button>}
    </>}
    {(['generating', 'unknown'] as const).some(state => job.status === state) && job.taskId && <Button variant="outline" disabled={busy}
      onClick={() => void act(async () => { const result = await checkDesignConstruction(scope, id); update(result.job); setUrl(result.url); })}>
      {busy ? 'Consultando…' : 'Consultar resultado sin regenerar'}</Button>}
    {(job.status === 'submitting' || job.status === 'unknown' && !job.taskId) && <p role="status" className="text-sm text-amber-800">Comprueba la tarea en KIE antes de otro intento. Una interrupción puede haber dejado una generación en curso.</p>}
    {url && <video src={url} controls playsInline preload="metadata" className="max-h-[55vh] w-full rounded-control bg-black" />}
    {job.status === 'review' && <>
      <p className="text-sm text-ink-soft">{visit ? 'Compara todo el clip con la referencia principal: muebles, TV, cortinas, puertas, ventanas, paredes y techo. La cámara debe permanecer dentro de la estancia y no atravesar sólidos.' : 'Revisa todo el clip: zonas exteriores, cubierta, cantidad y posición de muebles, muros consecutivos e identidad de la casa.'} Una prueba que pierda elementos debe rechazarse. Las cotas exactas aún no se componen en clips IA.</p>
      <div className="flex flex-wrap gap-2">{[true, false].map(accepted => <Button key={String(accepted)} variant={accepted ? 'default' : 'outline'} disabled={busy}
        onClick={() => void act(async () => { await reviewDesignConstruction(scope, id, accepted); update({ ...job, status: accepted ? 'accepted' : 'rejected' }); })}>
        {accepted ? 'Aceptar esta prueba' : 'Rechazar por falta de fidelidad'}</Button>)}</div>
    </>}
    {url && <a href={url} download className="inline-block text-sm text-brand-700 underline">Descargar prueba MP4</a>}
    {(onOpenSaved || job.status === 'accepted' && onCreateAdvertising) && <div className="flex flex-wrap gap-2 border-t border-line pt-3">
      {onOpenSaved && <Button variant="outline" disabled={busy} onClick={onOpenSaved}>Ver en Vídeos guardados</Button>}
      {job.status === 'accepted' && onCreateAdvertising && <Button variant="outline" disabled={busy} onClick={onCreateAdvertising}>Preparar publicidad con un vídeo guardado</Button>}
    </div>}
    {(error || job.error) && <p role="alert" className="text-sm text-danger">{error || job.error}</p>}
    <p className="text-xs text-ink-soft">Tarifa orientativa de KIE del 01/10/2026, sin reintentos ni auditorías de pago. No se inicia otra generación al consultar ni al rechazar. La devolución de una tarea fallida depende del proveedor.</p>
  </section>;
}
