import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import type { QualityFilters } from './quality-queries';

/**
 * Filtros del panel de eficacia: rango de fechas y organización opcional, con la misma lectura de
 * `from`/`to` (UTC, por defecto 30 días) que el panel de costes, para que página
 * y exportación no interpreten las fechas de forma distinta.
 */
export function qualityFilterParams(search: URLSearchParams): QualityFilters {
  const { from, to, organizationId } = aiCostFilterParams(search);
  return { from, to, organizationId };
}
