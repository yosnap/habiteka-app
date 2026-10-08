import { RENDER_FIDELITY_CRITERIA, type RenderFidelityReport } from '@/lib/editor-document/render-fidelity';

const statusLabel = { pass: 'Sin incidencias detectadas', fail: 'No cumple', uncertain: 'No verificable', 'not-visible': 'Fuera de vista' };

/** Comparte la evidencia real de visión, sin sustituirla por la puntuación del plano. */
export function RenderFidelityCard({ report, model }: { report?: RenderFidelityReport; model?: string }) {
  return <section aria-label="Criterios de la revisión visual" className="space-y-3 rounded-control border border-line p-3">
    <h3 className="text-sm font-semibold">Criterios de la revisión visual</h3>
    <p className="text-xs text-ink-soft">La revisión automática puede equivocarse. Comprueba la imagen antes de aceptarla.</p>
    {!report && <p className="text-sm">Esta versión no tiene un informe visual registrado. La fiabilidad del plano no evalúa esta imagen.</p>}
    {report && <>
      <p className="text-sm font-medium">{report.status === 'rejected' ? 'Revisión no superada' : 'Revisión automática superada'}</p>
      {!report.criteria && <p className="text-xs text-ink-soft">Informe anterior: no se guardaron los criterios de realismo, arquitectura y circulación por separado.</p>}
      {report.criteria?.toSorted((a, b) => Number(a.status === 'pass') - Number(b.status === 'pass')).map(item => <div key={item.id} className="space-y-1 border-t border-line pt-2">
        <p className="text-sm font-medium">{RENDER_FIDELITY_CRITERIA[item.id]}</p>
        <p className={`text-xs ${item.status === 'pass' ? 'text-brand-700' : 'text-destructive'}`}>{statusLabel[item.status]}</p>
        <p className="text-xs text-ink-soft">{item.observation}</p>
      </div>)}
      {([['Estancias', report.roomChecks], ['Puertas y ventanas', report.openingChecks], ['Zonas comunicadas sin puerta', report.openAreaChecks ?? []], ['Terreno, cerramientos y objetos exteriores', report.exteriorChecks ?? []], ['Sanitarios y placas por estancia', report.fixtureChecks ?? []]] as const).map(([label, checks]) => checks.length > 0 &&
        <details key={label} className="border-t border-line pt-2">
          <summary className="cursor-pointer text-sm font-medium">{label} ({checks.length})</summary>
          <ul className="mt-3 space-y-3">{checks.map(item => <li key={item.id} className="text-xs">
            <p className="font-medium">{item.name ? `${item.name} · ${item.id}` : item.id} — {statusLabel[item.status]}</p>
            <p className="mt-1 text-ink-soft">{item.observation}</p>
          </li>)}</ul>
        </details>)}
      {report.constructionCheck && <div className="space-y-1 border-t border-line pt-2">
        <p className="text-sm font-medium">Construcciones añadidas</p>
        <p className={`text-xs ${report.constructionCheck.status === 'pass' ? 'text-brand-700' : 'text-destructive'}`}>{statusLabel[report.constructionCheck.status]}</p>
        <p className="text-xs text-ink-soft">{report.constructionCheck.observation}</p>
      </div>}
      {!!report.violations?.length && <details><summary className="cursor-pointer text-sm font-medium text-destructive">Motivos del descarte</summary>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-xs">{[...new Set(report.violations)].map(reason => <li key={reason}>{reason}</li>)}</ul>
      </details>}
    </>}
    {model && <p className="break-words border-t border-line pt-2 text-xs text-ink-soft">Modelo de imagen: {model}</p>}
    {report?.model && <p className="break-words text-xs text-ink-soft">Modelo de revisión: {report.model}</p>}
  </section>;
}
