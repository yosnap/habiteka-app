'use server';

import { requireAdmin } from '@/server/admin/guard';
import { queryQualityEfficacy, type QualityFilters } from './quality-queries';

/** Frontera server-side del panel de eficacia; revalida RBAC en cada lectura. */
export async function getQualityEfficacyReport(filters: QualityFilters) {
  await requireAdmin();
  return queryQualityEfficacy(filters);
}
