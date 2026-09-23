import { QualityCheckpointTable } from '@/components/admin/quality-checkpoint-table';
import { QualityProviderTable } from '@/components/admin/quality-provider-table';
import { QualitySavingsPanel } from '@/components/admin/quality-savings-panel';
import { getQualityEfficacyReport } from '@/server/admin/analytics/quality-actions';
import { qualityFilterParams } from '@/server/admin/analytics/quality-filter-params';

type Search = Record<string, string | string[] | undefined>;

function value(search: Search, key: string): string {
  const raw = search[key];
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function usd(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
  }).format(amount);
}

export default async function QualityEfficacyPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const params = new URLSearchParams(Object.keys(search).map((key) => [key, value(search, key)]));
  const filters = qualityFilterParams(params);
  const report = await getQualityEfficacyReport(filters);
  const { totals, cost } = report;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Eficacia de la calidad (Jev)</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Qué decide cada punto de control y qué le cuesta a la plataforma. Evaluaciones y costes
          se cruzan por referencia del entregable dentro del mismo rango. Fechas en UTC.
        </p>
        <a className="mt-2 inline-block text-sm underline" href={`/api/admin/quality/export?${params}`}>
          Exportar informe filtrado (CSV)
        </a>
      </div>

      <form method="get" className="rounded-card border-line bg-surface grid gap-3 border p-4 md:grid-cols-3">
        <label className="text-muted-foreground text-xs font-medium">
          Desde
          <input
            name="from"
            type="date"
            defaultValue={day(filters.from)}
            className="border-line bg-surface rounded-control mt-1 w-full border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-muted-foreground text-xs font-medium">
          Hasta
          <input
            name="to"
            type="date"
            defaultValue={day(filters.to)}
            className="border-line bg-surface rounded-control mt-1 w-full border px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-control bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Aplicar filtros
        </button>
      </form>

      {!report.hasData ? (
        <p className="rounded-card border-line text-muted-foreground border p-6 text-center text-sm">
          No hay evaluaciones ni gasto de IA en este rango. Ajusta las fechas o espera a que la
          plataforma genere actividad.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Evaluaciones" value={String(totals.evaluations)} />
            <Metric
              label="Score medio"
              value={totals.avgScore === null ? '—' : `${totals.avgScore.toFixed(1)} / 100`}
            />
            <Metric
              label="Sin evaluar (Jev no respondió)"
              value={
                totals.evaluations
                  ? `${((100 * totals.unevaluated) / totals.evaluations).toFixed(1)} %`
                  : '—'
              }
            />
            <Metric label="Coste de Jev" value={usd(cost.jevCostUsd)} />
            <Metric label="Coste de IA total" value={usd(cost.totalUsd)} />
            <Metric label="Coste de resultados aceptados" value={usd(cost.acceptedUsd)} />
            <Metric
              label="Gasto desperdiciado"
              value={usd(cost.wastedUsd)}
              hint={`${usd(cost.blockedUsd)} bloqueados · ${usd(cost.iteratedUsd)} rehechos`}
            />
            <Metric label="Ahorro estimado por bloqueos previos" value={usd(cost.avoidedUsd)} />
          </div>

          <QualityCheckpointTable rows={report.checkpoints} />
          <QualitySavingsPanel report={report} />

          <div>
            <h2 className="mb-2 font-semibold">Proveedores y modelos</h2>
            <QualityProviderTable rows={report.providers} />
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border-line bg-surface border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}
