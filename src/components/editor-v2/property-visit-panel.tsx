'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { EditorScope } from '@/server/editor/authority';
import { inspectPropertyVisit } from '@/server/walkthrough/property-visit-actions';
import { LIGHTING_LABELS, LIGHTING_PRESETS, type LightingPreset } from '@/lib/lighting-preset';
import { ModernSelect } from '@/components/ui/modern-select';
import { PropertyVisitMap } from './property-visit-map';
import { PropertyVisitSaved } from './property-visit-saved';

type Report = Awaited<ReturnType<typeof inspectPropertyVisit>>;
const duration = (seconds: number) => `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;

export function PropertyVisitPanel({ scope, onBusyChange, onReviewApproval, portalContainer }: {
  scope: EditorScope; onBusyChange: (value: boolean) => void; onReviewApproval: () => void; portalContainer?: HTMLElement | null;
}) {
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [productionBusy, setProductionBusy] = useState(false);
  const handleProductionBusy = useCallback((value: boolean) => { setProductionBusy(value); onBusyChange(value); }, [onBusyChange]);
  const locked = busy || productionBusy;
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    const sequence = ++request.current;
    onBusyChange(true);
    void inspectPropertyVisit(scope).then(value => { if (active && sequence === request.current) setReport(value); })
      .catch(cause => { if (active && sequence === request.current) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la preparación.'); })
      .finally(() => { if (active && sequence === request.current) { setBusy(false); onBusyChange(false); } });
    return () => { active = false; request.current = -1; onBusyChange(false); };
  }, [scope, onBusyChange]);
  async function prepare(approvalId = report?.approvalId, entryId = report?.plan.entry?.id, lighting: LightingPreset = report?.lighting ?? 'daylight', openDoors = report?.openDoors ?? true) {
    if (locked) return;
    const sequence = ++request.current;
    setBusy(true); onBusyChange(true); setError('');
    try { const next = await inspectPropertyVisit(scope, { approvalId, entryId: entryId || undefined, lighting, openDoors }); if (sequence === request.current) setReport(next); }
    catch (cause) { if (sequence === request.current) { setReport(null); setError(cause instanceof Error ? cause.message : 'No se pudo preparar el recorrido.'); } }
    finally { if (sequence === request.current) { setBusy(false); onBusyChange(false); } }
  }
  const covered = report?.plan.coverage.filter(zone => zone.status === 'planned').length ?? 0;
  const base = `/projects/${encodeURIComponent(scope.projectId)}`;
  const query = scope.zoneId ? `?zona=${encodeURIComponent(scope.zoneId)}` : '';
  return <section className="mx-auto w-full max-w-6xl space-y-5 p-5" aria-label="Paseo por todo el inmueble">
    <header><h2 className="text-xl font-semibold">Paseo por todo el inmueble</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">Un paseo rápido de hasta 60 segundos desde el exterior, entrando por una puerta real y pasando por todas las zonas. La construcción es otro vídeo independiente. Máximo 2 € de generación de vídeo por pieza.</p></header>
    <p className="rounded-control border border-line bg-surface-muted p-3 text-sm">Preparar el recorrido no consume IA ni cambia tu plano. El vídeo final necesita diseños aceptados para los encuadres y pasos entre zonas.</p>
    {error && <div role="alert"><p>{error}</p><button type="button" className="mt-2 underline" disabled={busy} onClick={() => void prepare()}>Volver a cargar</button>{/versión/.test(error) && <button type="button" className="ml-3 underline" onClick={onReviewApproval}>Revisar versión del proyecto</button>}</div>}
    {busy && <p role="status">Comprobando accesos, cobertura y encuadres…</p>}
    {report && <>
      <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Versión aprobada de origen<ModernSelect value={report.approvalId} portalContainer={portalContainer} onChange={e => void prepare(e.target.value, '', report.lighting)}>
          {report.approvals.map(approval => <option key={approval.id} value={approval.id}>Revisión {approval.revision}</option>)}
        </ModernSelect></label>
        <label className="text-sm sm:col-span-2"><input type="checkbox" checked={report.openDoors} onChange={event => void prepare(report.approvalId, report.plan.entry?.id, report.lighting, event.target.checked)} /> Preparar las puertas abiertas para el paseo, conservando el plano guardado</label>
        <label className="text-sm">Luz de los diseños<ModernSelect value={report.lighting} portalContainer={portalContainer} onChange={e => void prepare(report.approvalId, report.plan.entry?.id, e.target.value as LightingPreset)}>
          {LIGHTING_PRESETS.map(light => <option key={light} value={light}>{LIGHTING_LABELS[light]}</option>)}
        </ModernSelect></label>
        <label className="text-sm sm:col-span-2">Entrada del paseo<ModernSelect value={report.plan.entry?.id ?? ''} portalContainer={portalContainer} onChange={e => void prepare(report.approvalId, e.target.value || undefined)}>
          <option value="">Elige en la lista o en el plano</option>
          {report.entries.map((entry, i) => <option key={entry.id} value={entry.id}>{i + 1}. {entry.label}{entry.issue ? ' · requiere revisión' : ''}</option>)}
        </ModernSelect></label>
      </fieldset>
      <p className="text-xs text-ink-soft">Origen: revisión {report.revision}. Esta selección no incorpora cambios posteriores del editor ni acepta imágenes.</p>
      {!!report.openedDoorIds.length && <p className="text-sm">El paseo prepara {report.openedDoorIds.length} puertas abiertas. Sus nuevos encuadres deben mostrar ese estado; las imágenes de puertas cerradas no se reutilizan automáticamente.</p>}
      <PropertyVisitMap report={report} onEntry={id => { if (!locked) void prepare(report.approvalId, id); }} />
      <div className="grid gap-3 sm:grid-cols-3">
        <p className="rounded-control border border-line p-3"><strong>{covered} / {report.plan.coverage.length}</strong><span className="block text-sm">zonas con trazado detallado</span></p>
        <p className="rounded-control border border-line p-3"><strong>{report.plan.frames.length ? duration(report.plan.durationSeconds) : 'Por calcular'}</strong><span className="block text-sm">{report.plan.complete ? 'duración del trazado propuesto' : 'duración parcial; faltan zonas o acceso'}</span></p>
        <p className="rounded-control border border-line p-3"><strong>{report.plan.frames.length ? `${report.references.matched} / ${report.plan.frames.length}` : 'Por preparar'}</strong><span className="block text-sm">encuadres con una imagen aceptada coincidente</span></p>
      </div>
      {!!report.plan.issues.length && <div role="status" className="rounded-control border border-line p-3"><strong>Antes de generar el paseo</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{report.plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <div><h3 className="font-semibold">Todas las zonas</h3><p className="mt-1 text-sm text-ink-soft">Una zona pendiente impide dar el recorrido por completo. El trazado todavía necesita comprobarse contra el mobiliario de los diseños aceptados.</p>
        <ul className="mt-3 divide-y divide-line">{report.plan.coverage.map(zone => <li key={zone.id} className="py-2 text-sm"><strong>{zone.name}</strong> · {zone.status === 'planned' ? 'Incluida en el trazado' : 'Pendiente'}{zone.issue && <p className="text-ink-soft">{zone.issue}</p>}</li>)}</ul>
      </div>
      <p className="text-sm text-ink-soft">Hay {report.acceptedViews} vistas a altura de ojos aceptadas y compatibles con esta versión y luz. Cada clip enlaza dos encuadres aceptados y conserva los pasos intermedios de la ruta como guía. Hay que revisar en el vídeo generado que todas las zonas aparecen y mantienen su diseño; el trazado no lo garantiza.</p>
      {!!report.plan.frames.length && <details className="text-sm"><summary className="cursor-pointer font-semibold">Ver encuadres y pasos previstos ({report.plan.frames.length})</summary>
        <ol className="mt-3 max-h-80 list-decimal space-y-1 overflow-auto pl-6">{report.plan.frames.map(frame => <li key={frame.id}>{frame.label} · {frame.secondsFromPrevious} s{report.references.missing.includes(frame.id) ? ' · falta referencia de este encuadre' : ' · referencia coincidente; falta revisión de continuidad'}</li>)}</ol>
      </details>}
      <p role="status" className="rounded-control border border-line p-3 text-sm">{report.generationIssue}</p>
      <PropertyVisitSaved scope={scope} report={report} onBusyChange={handleProductionBusy} />
      <div className="flex flex-wrap gap-3 text-sm"><Link href={`${base}${query}`} className="rounded-control border border-line px-3 py-2">Revisar accesos en el editor</Link>
        <Link href={`${base}/deliverables${query}`} className="rounded-control border border-line px-3 py-2">Revisar diseños aceptados</Link>
        <button type="button" className="rounded-control border border-line px-3 py-2" disabled={locked} onClick={() => void prepare()}>Actualizar preparación</button></div>
    </>}
  </section>;
}
