import 'server-only';
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';

/** Cuántas organizaciones han elegido sus propios modelos en cada uso: a las demás les afecta la recomendación. */
export async function modelAdoption(): Promise<{ organizations: number; customized: Partial<Record<ModelAction, number>> }> {
  const [organizations, rows] = await Promise.all([
    prisma.organization.count(),
    prisma.organizationModelRoute.groupBy({ by: ['action'], where: { position: 0 }, _count: { _all: true } }),
  ]);
  return { organizations, customized: Object.fromEntries(rows.map((row) => [row.action, row._count._all])) };
}
