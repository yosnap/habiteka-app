/** Exportación CSV del panel de eficacia: solo admin y sin fórmulas ejecutables. */
import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/admin/quality/export/route';
import { ForbiddenAdminError, requireAdmin } from '@/server/admin/guard';
import { prisma } from '@/server/db/prisma';
import { resetDb } from '../helpers/db';

vi.mock('@/server/admin/guard', () => ({
  requireAdmin: vi.fn(),
  ForbiddenAdminError: class extends Error {},
}));

beforeEach(async () => {
  await resetDb();
  await prisma.aiQualityEvaluation.deleteMany();
  await prisma.aiRequestCost.deleteMany();
  vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin', email: 'admin@test.local' });
});

it('exporta el informe agregado del rango pedido', async () => {
  await prisma.aiQualityEvaluation.create({
    data: {
      organizationId: 'org-csv', checkpoint: 'plan_extraction', decision: 'block', score: 30,
      answers: {}, reasons: [], evidenceHash: 'h1', costUsd: '0.00020000', failOpen: true,
      createdAt: new Date('2026-09-10T10:00:00Z'),
    },
  });
  await prisma.aiRequestCost.create({
    data: {
      requestId: 'r1', attempt: 0, organizationId: 'org-csv', action: 'render3d',
      operation: 'render3d', provider: '=FORMULA', model: 'm', status: 'success', latencyMs: 5,
      costUsd: '0.20000000', costType: 'confirmed', createdAt: new Date('2026-09-10T10:00:00Z'),
    },
  });

  const response = await GET(
    new Request('http://localhost/api/admin/quality/export?from=2026-09-01&to=2026-09-30'),
  );
  const csv = await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('text/csv');
  expect(csv).toContain('plan_extraction');
  expect(csv).toContain('estimado_usd');
  // El ahorro estimado es 1 bloqueo × 0,20 USD de media por generación.
  expect(csv).toContain('0.20000000');
  expect(csv).toContain("'=FORMULA");
});

it('impide la exportación sin administrador', async () => {
  vi.mocked(requireAdmin).mockRejectedValueOnce(new ForbiddenAdminError());
  const response = await GET(new Request('http://localhost/api/admin/quality/export'));
  expect(response.status).toBe(403);
});
