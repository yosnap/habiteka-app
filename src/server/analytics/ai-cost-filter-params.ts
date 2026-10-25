import type { AiCostFilters } from './ai-cost-queries';

/** Contrato común para página y exportación; fechas UTC explícitas. */
export function aiCostFilterParams(search: URLSearchParams): AiCostFilters {
  const now = new Date();
  const date = (key: string, fallback: Date, end = false) => {
    const raw = search.get(key) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
    const parsed = new Date(`${raw}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  };
  const group = search.get('groupBy');
  const status = search.get('status');
  const from = date('from', new Date(now.getTime() - 30 * 86400000));
  const to = date('to', now, true);
  // Id de organización del filtro del panel global; «Mi perfil» lo ignora y fija la de la sesión.
  const org = search.get('org') ?? '';
  return { from: from > to ? to : from, to,
    organizationId: /^[\w-]{1,64}$/.test(org) ? org : undefined,
    provider: search.get('provider') || undefined, model: search.get('model') || undefined,
    status: status === 'success' || status === 'error' ? status : undefined,
    groupBy: group === 'design' || group === 'provider' || group === 'model' || group === 'user' || group === 'action' ? group : 'project',
    page: Math.max(1, Number.parseInt(search.get('page') ?? '1') || 1),
    interval: search.get('interval') === 'month' ? 'month' : 'day' };
}
