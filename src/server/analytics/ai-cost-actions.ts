'use server';

import { requireAdmin } from '@/server/admin/guard';
import { queryAiCosts, type AiCostFilters } from './ai-cost-queries';

/** Frontera server-side del informe; la página y futuras exportaciones revalidan RBAC. */
export async function getAdminAiCostReport(filters: AiCostFilters) {
  await requireAdmin();
  return queryAiCosts(filters);
}
