import { ModernSelect } from '@/components/ui/modern-select';
import { getAdminAiCostReport } from '@/server/analytics/ai-cost-actions';
import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import { AiCostTimeline } from '@/components/admin/ai-cost-timeline';
import { AiCreditSummary } from '@/components/admin/ai-credit-summary';
import { AiCostDetails } from '@/components/admin/ai-cost-details';

type Search = Record<string, string | string[] | undefined>;

function value(search: Search, key: string): string {
  const raw = search[key];
  return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
}

function day(date: Date): string { return date.toISOString().slice(0, 10); }
function usd(amount: number): string { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(amount); }

export default async function AiCostsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const params = new URLSearchParams(Object.keys(search).map(key => [key, value(search, key)]));
  const filters = aiCostFilterParams(params);
  const { from, to, groupBy } = filters;
  const groupLabel = { project: 'Proyecto', design: 'Diseño / referencia', provider: 'Proveedor', model: 'Modelo', user: 'Usuario' }[groupBy ?? 'project'];
  const provider = value(search, 'provider');
  const model = value(search, 'model');
  const rawStatus = value(search, 'status');
  const report = await getAdminAiCostReport(filters);
  const pageLink = (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `?${next}`; };

  return <section className="flex flex-col gap-6">
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Costes de IA</h1>
      <p className="mt-1 text-sm text-muted-foreground">Control operativo por petición e intento. No representa créditos cobrados al cliente. Fechas en UTC.</p>
      <a className="mt-2 inline-block text-sm underline" href={`/api/admin/ai-costs/export?${params}`}>Exportar registros filtrados (CSV)</a>
    </div>

    <form method="get" className="grid gap-3 rounded-card border border-line bg-surface p-4 md:grid-cols-3 xl:grid-cols-6">
      <label className="text-xs font-medium text-muted-foreground">Desde
        <input name="from" type="date" defaultValue={day(from)} className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
      </label>
      <label className="text-xs font-medium text-muted-foreground">Hasta
        <input name="to" type="date" defaultValue={day(to)} className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
      </label>
      <Filter label="Proveedor" name="provider" current={provider} values={report.providers} />
      <Filter label="Modelo" name="model" current={model} values={report.models} />
      <label className="text-xs font-medium text-muted-foreground">Estado
        <ModernSelect name="status" defaultValue={rawStatus} className="mt-1"><option value="">Todos</option><option value="success">Correcto</option><option value="error">Error</option></ModernSelect>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Agrupar por
        <ModernSelect name="groupBy" defaultValue={groupBy} className="mt-1"><option value="project">Proyecto</option><option value="design">Diseño / referencia</option><option value="provider">Proveedor</option><option value="model">Modelo</option><option value="user">Usuario</option></ModernSelect>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Evolución
        <ModernSelect name="interval" defaultValue={filters.interval} className="mt-1"><option value="day">Diaria</option><option value="month">Mensual</option></ModernSelect>
      </label>
      <button type="submit" className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground md:col-span-3 xl:col-span-1">Aplicar filtros</button>
    </form>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Coste confirmado" value={usd(report.totals.confirmedUsd)} />
      <Metric label="Coste estimado" value={usd(report.totals.estimatedUsd)} />
      <Metric label="Coste desconocido" value={`${report.totals.unknownAttempts} intentos`} />
      <Metric label="Intentos / errores" value={`${report.totals.attempts} / ${report.totals.errors}`} />
      <Metric label="Peticiones únicas" value={String(report.requests)} />
      <Metric label="Intentos de respaldo" value={String(report.fallbackAttempts)} />
      <Metric label="Tasa de error por intento" value={report.totals.attempts ? `${(100 * report.totals.errors / report.totals.attempts).toFixed(1)} %` : '—'} />
      <Metric label="Latencia media" value={report.totals.attempts ? `${Math.round(report.totals.latencyMs / report.totals.attempts)} ms` : '—'} />
    </div>
    <AiCostTimeline points={report.timeline} />
    <AiCreditSummary from={from} to={to} />

    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-muted-foreground"><tr><th className="px-3 py-2">{groupLabel}</th><th className="px-3 py-2">Intentos</th><th className="px-3 py-2">Correctos</th><th className="px-3 py-2">Errores</th><th className="px-3 py-2">Confirmado</th><th className="px-3 py-2">Estimado</th><th className="px-3 py-2">Desconocidos</th><th className="px-3 py-2">Latencia media</th></tr></thead>
        <tbody>{report.groups.map((group) => <tr key={group.key} className="border-t border-line"><td className="px-3 py-2 font-medium">{group.label}</td><td className="px-3 py-2">{group.attempts}</td><td className="px-3 py-2">{group.successes}</td><td className="px-3 py-2">{group.errors}</td><td className="px-3 py-2">{usd(group.confirmedUsd)}</td><td className="px-3 py-2">{usd(group.estimatedUsd)}</td><td className="px-3 py-2">{group.unknownAttempts}</td><td className="px-3 py-2">{group.attempts ? Math.round(group.latencyMs / group.attempts) : 0} ms</td></tr>)}</tbody>
      </table>
      {report.groups.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No hay intentos de IA para estos filtros.</p>}
    </div>

    <div className="overflow-x-auto rounded-card border border-line">
      <div className="flex items-center justify-between gap-3 p-3">
        <h2 className="font-semibold">Detalle por petición e intento</h2>
        <p className="text-xs text-muted-foreground">Página {report.page} de {report.pageCount} · {report.detailTotal} registros</p>
      </div>
      <AiCostDetails rows={report.details} />
      <nav aria-label="Páginas de registros" className="flex justify-between border-t p-3 text-sm">
        {report.page > 1 ? <a href={pageLink(report.page - 1)}>← Anterior</a> : <span />}
        {report.page < report.pageCount && <a href={pageLink(report.page + 1)}>Siguiente →</a>}
      </nav>
    </div>
  </section>;
}

function Filter({ label, name, current, values }: { label: string; name: string; current: string; values: string[] }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<ModernSelect name={name} defaultValue={current} className="mt-1"><option value="">Todos</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</ModernSelect></label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-card border border-line bg-surface p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
