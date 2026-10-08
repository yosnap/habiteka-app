'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import { useCallback, useEffect, useState } from 'react';
import type { EditorScope } from '@/server/editor/authority';
import type { inspectPropertyVisit } from '@/server/walkthrough/property-visit-actions';
import { listPropertyVisits, savePropertyVisit } from '@/server/walkthrough/property-visit-job-actions';
import { PropertyVisitProduction } from './property-visit-production';
import { Button } from '@/components/ui/button';
type Report = Awaited<ReturnType<typeof inspectPropertyVisit>>;
export function PropertyVisitSaved({ scope, report, onBusyChange }: { scope: EditorScope; report: Report; onBusyChange: (value: boolean) => void }) {
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof listPropertyVisits>>>([]), [selected, setSelected] = useState('');
  const [top, setTop] = useState(''), [exterior, setExterior] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [productionBusy, setProductionBusy] = useState(false);
  const handleBusy = useCallback((value: boolean) => { setProductionBusy(value); onBusyChange(value); }, [onBusyChange]);
  const locked = busy || productionBusy;
  useEffect(() => { let active = true; void listPropertyVisits(scope).then(value => { if (active) setSaved(value); })
    .catch(cause => { if (active) setError(String(cause)); }); return () => { active = false; }; }, [scope]);
  const tops = report.anchors.filter(anchor => anchor.preset === 'top');
  const roofs = report.anchors.filter(anchor => anchor.closedRoof && anchor.preset !== 'custom' && anchor.preset !== 'top');
  const topId = tops.some(anchor => anchor.id === top) ? top : tops[0]?.id ?? '';
  const exteriorId = roofs.some(anchor => anchor.id === exterior) ? exterior : roofs[0]?.id ?? '';
  async function save() {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await savePropertyVisit(scope, { approvalId: report.approvalId, entryId: report.plan.entry!.id,
        openDoors: report.openDoors, lighting: report.lighting, anchorIds: [topId, exteriorId] });
      setSaved(value => [result, ...value]); setSelected(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el paseo.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <section className="space-y-4">
    <h3 className="font-semibold">Diseño que conserva todo el paseo</h3>
    <p className="text-sm">La cenital fija el interiorismo de todas las zonas. La vista exterior fija fachadas, tejado y pérgolas. Ambas deben estar aceptadas y usar la misma luz y versión.</p>
    <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Interiorismo aceptado<ModernSelect className="block w-full rounded border border-line p-2" value={topId} onChange={event => setTop(event.target.value)}><option value="">Falta una cenital aceptada</option>{tops.map(anchor => <option key={anchor.id} value={anchor.id}>{anchor.view} · {anchor.name} · {anchor.id.slice(-8)}</option>)}</ModernSelect></label>
      <label className="text-sm">Exterior aceptado<ModernSelect className="block w-full rounded border border-line p-2" value={exteriorId} onChange={event => setExterior(event.target.value)}><option value="">Falta un exterior aceptado</option>{roofs.map(anchor => <option key={anchor.id} value={anchor.id}>{anchor.view} · {anchor.name} · {anchor.id.slice(-8)}</option>)}</ModernSelect></label>
    </fieldset>
    <Button disabled={locked || !report.plan.complete || !topId || !exteriorId} onClick={() => void save()}>Guardar paseo y calcular generación · sin gasto</Button>
    {error && <p role="alert">{error}</p>}
    {!!saved.length && <label className="block text-sm">Continuar un paseo guardado<ModernSelect disabled={locked} className="ml-2 rounded border border-line p-2" value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">Selecciona el paseo</option>{saved.map(item => <option key={item.id} value={item.id}>Revisión {item.job.approvedRevision} · {(item.job.durationMs / 60000).toFixed(1)} min · {new Date(item.job.createdAt).toLocaleString('es')}</option>)}</ModernSelect></label>}
    {selected && <PropertyVisitProduction key={selected} scope={scope} id={selected} onBusyChange={handleBusy} />}
  </section>;
}
