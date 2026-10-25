/**
 * Informe de uso y costes de IA de la organización: cifras, evolución, reparto y errores; y debajo la eficacia de
 * las comprobaciones de calidad (Jev). Solo presentación: los datos ya vienen limitados a la organización.
 */
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AiCostReport } from '@/server/analytics/ai-cost-queries';
import type { QualityEfficacyReport } from '@/server/admin/analytics/quality-queries';
import { AiCostTimeline } from '@/components/profile/ai-cost-timeline';
import { Card } from '@/components/ui/card';
import { aiErrorLabel } from '@/lib/ai-error-labels';
import { checkpointLabel } from '@/lib/quality-checkpoint-labels';

const money = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);

function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <Card className="p-4">
      <p className="text-ink-soft text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-ink mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="text-ink-soft mt-1 text-xs">{detail}</p> : null}
    </Card>
  );
}

export function UsageCostReport({ report, groupLabel, labelOf }: { report: AiCostReport; groupLabel: string; labelOf: (key: string, label: string) => string }) {
  const { totals } = report;
  const spent = totals.confirmedUsd + totals.estimatedUsd;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Coste" value={money(spent)} detail={`${money(totals.confirmedUsd)} confirmados por el proveedor${totals.unknownAttempts ? ` · ${totals.unknownAttempts} sin importe conocido` : ''}`} />
        <Metric label="Peticiones" value={report.requests} detail={`${totals.attempts} intentos, ${report.fallbackAttempts} con un modelo de respaldo`} />
        <Metric label="Errores" value={totals.errors} detail={totals.attempts ? `${(100 * totals.errors / totals.attempts).toFixed(1)} % de los intentos` : 'Sin intentos'} />
        <Metric label="Tiempo medio" value={totals.attempts ? `${(totals.latencyMs / totals.attempts / 1000).toFixed(1)} s` : '—'} detail="Por intento" />
      </div>
      <AiCostTimeline points={report.timeline} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-ink-soft text-left text-xs"><tr className="border-line border-b">
              <th className="px-4 py-2.5">{groupLabel}</th><th className="px-4 py-2.5">Intentos</th><th className="px-4 py-2.5">Errores</th><th className="px-4 py-2.5">Coste</th>
            </tr></thead>
            <tbody>{report.groups.map((group) => (
              <tr key={group.key} className="border-line border-t">
                <td className="text-ink px-4 py-2.5 font-medium">{labelOf(group.key, group.label)}</td>
                <td className="px-4 py-2.5">{group.attempts}</td>
                <td className="px-4 py-2.5">{group.errors}</td>
                <td className="px-4 py-2.5">{money(group.confirmedUsd + group.estimatedUsd)}</td>
              </tr>
            ))}</tbody>
          </table>
          {report.groups.length === 0 ? <p className="text-ink-soft p-6 text-center text-sm">Sin uso de IA en estas fechas.</p> : null}
        </Card>
        <Card className="p-4">
          <h3 className="text-ink flex items-center gap-2 text-base font-semibold"><AlertTriangle size={16} aria-hidden />Por qué fallaron</h3>
          {report.errorCodes.length ? (
            <ul className="divide-line mt-2 divide-y text-sm">{report.errorCodes.map((error) => (
              <li key={error.code} className="flex items-center justify-between gap-3 py-2"><span className="text-ink-soft">{aiErrorLabel(error.code)}</span><span className="text-ink font-medium">{error.count}</span></li>
            ))}</ul>
          ) : <p className="text-ink-soft mt-2 text-sm">Ningún error en estas fechas.</p>}
        </Card>
      </div>
    </>
  );
}

export function UsageQualityReport({ report }: { report: QualityEfficacyReport }) {
  const { totals, cost, savings } = report;
  const blocked = savings.reduce((sum, row) => sum + row.blocked, 0);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <header>
        <h3 className="text-ink flex items-center gap-2 text-base font-semibold"><ShieldCheck size={16} aria-hidden />Eficacia: comprobaciones de calidad</h3>
        <p className="text-ink-soft mt-1 text-sm">Antes de gastar en una generación, Jev comprueba si el plano o la petición son fiables, y después puntúa el resultado. Su coste lo paga Habiteka, no tu organización.</p>
      </header>
      {!report.hasData ? <p className="text-ink-soft text-sm">Sin comprobaciones en estas fechas.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Comprobaciones" value={totals.evaluations} detail={`${totals.proceed} siguieron, ${totals.confirm} pidieron confirmación`} />
            <Metric label="Generaciones frenadas" value={blocked} detail="Bloqueos que evitaron gastar en una generación" />
            <Metric label="Gasto evitado" value={money(cost.avoidedUsd)} detail="Estimado con el coste medio de tus generaciones" />
            <Metric label="Nota media" value={totals.avgScore === null ? '—' : `${totals.avgScore.toFixed(1)} / 100`} detail="En los resultados puntuados" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Aceptado sin rehacer" value={money(cost.acceptedUsd)} />
            <Metric label="Rehecho con retoques" value={money(cost.iteratedUsd)} />
            <Metric label="Sin puntuar" value={money(cost.unscoredUsd)} />
          </div>
          {report.checkpoints.length ? (
            <ul className="divide-line divide-y text-sm">{report.checkpoints.map((row) => (
              <li key={row.checkpoint} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-ink">{checkpointLabel(row.checkpoint)}</span>
                <span className="text-ink-soft text-xs">{row.evaluations} comprobaciones · {row.block} bloqueos · nota {row.avgScore === null ? '—' : `${row.avgScore.toFixed(1)} / 100`}</span>
              </li>
            ))}</ul>
          ) : null}
        </>
      )}
    </Card>
  );
}
