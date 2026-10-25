/**
 * Mi perfil › Uso y costes: lo que la organización gasta en sus proveedores de IA y cómo rinden las comprobaciones de
 * calidad. La organización sale siempre de la sesión; los filtros de la URL solo eligen fechas y agrupación.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import { queryAiCosts } from '@/server/analytics/ai-cost-queries';
import { queryQualityEfficacy } from '@/server/admin/analytics/quality-queries';
import { MODEL_USE_GUIDE } from '@/lib/ai-model-guide';
import { ModernSelect } from '@/components/ui/modern-select';
import { ProfileSection } from '@/components/profile/profile-section';
import { UsageCostReport, UsageQualityReport } from '@/components/profile/usage-report';

export const metadata = { title: 'Uso y costes — Habiteka' };

type Search = Record<string, string | string[] | undefined>;
const GROUPS = { action: 'Función', model: 'Modelo', provider: 'Proveedor', project: 'Proyecto', user: 'Persona' } as const;
const USE_LABELS = new Map(MODEL_USE_GUIDE.map((use) => [use.action as string, use.label]));
const day = (date: Date) => date.toISOString().slice(0, 10);

export default async function UsagePage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireOrgContext();
  const search = await searchParams;
  const params = new URLSearchParams(Object.entries(search).flatMap(([key, raw]) => {
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? [[key, value]] : [];
  }));
  const parsed = aiCostFilterParams(params);
  const groupBy = parsed.groupBy && parsed.groupBy in GROUPS && params.has('groupBy') ? parsed.groupBy as keyof typeof GROUPS : 'action';
  // Nunca la organización de la URL: siempre la de la sesión.
  const filters = { from: parsed.from, to: parsed.to, interval: parsed.interval, groupBy, organizationId: ctx.organizationId };
  const [costs, quality] = await Promise.all([queryAiCosts(filters), queryQualityEfficacy(filters)]);
  const labelOf = (key: string, label: string) => groupBy === 'action' ? USE_LABELS.get(key) ?? key : label;
  const field = 'border-line bg-surface text-ink mt-1 w-full rounded-control border px-2 py-1.5 text-sm';
  return (
    <ProfileSection title="Uso y costes" description="Lo que tu organización ha usado de la IA y lo que le han cobrado sus proveedores. El coste confirmado lo informa el proveedor; el resto se estima con el precio del modelo. Fechas en UTC.">
      <form method="get" className="border-line bg-surface grid gap-3 rounded-card border p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-ink-soft text-xs font-medium">Desde<input name="from" type="date" defaultValue={day(filters.from)} className={field} /></label>
        <label className="text-ink-soft text-xs font-medium">Hasta<input name="to" type="date" defaultValue={day(filters.to)} className={field} /></label>
        <label className="text-ink-soft text-xs font-medium">Agrupar por
          <ModernSelect name="groupBy" defaultValue={groupBy} className="mt-1">
            {Object.entries(GROUPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </ModernSelect>
        </label>
        <label className="text-ink-soft text-xs font-medium">Evolución
          <ModernSelect name="interval" defaultValue={filters.interval} className="mt-1"><option value="day">Diaria</option><option value="month">Mensual</option></ModernSelect>
        </label>
        <button type="submit" className="bg-primary text-primary-foreground self-end rounded-control px-4 py-2 text-sm font-medium">Aplicar</button>
      </form>
      <UsageCostReport report={costs} groupLabel={GROUPS[groupBy]} labelOf={labelOf} />
      <UsageQualityReport report={quality} />
    </ProfileSection>
  );
}
