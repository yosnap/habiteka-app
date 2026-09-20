import { beforeEach, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb } from '../helpers/db';
import { GET } from '@/app/api/admin/ai-costs/export/route';
import { requireAdmin, ForbiddenAdminError } from '@/server/admin/guard';

vi.mock('@/server/admin/guard', () => ({ requireAdmin: vi.fn(), ForbiddenAdminError: class extends Error {} }));
beforeEach(async () => {
  await resetDb(); await prisma.aiRequestCost.deleteMany();
  vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin', email: 'admin@test.local' });
});
it('exporta todos los lotes y respeta filtros sin interpretar fórmulas', async () => {
  await prisma.aiRequestCost.createMany({ data: Array.from({ length: 501 }, (_, index) => ({
    requestId: `csv-${index}`, attempt: 0, organizationId: 'org', action: 'vision' as const,
    operation: 'vision', provider: 'openrouter', model: '=FORMULA', status: 'success', latencyMs: 2,
    costType: 'unknown', createdAt: new Date('2026-09-15T10:00:00Z'),
  })) });
  const response = await GET(new Request('http://localhost/api/admin/ai-costs/export?from=2026-09-15&to=2026-09-15&provider=openrouter'));
  const csv = await response.text();
  expect(response.status).toBe(200);
  expect(csv.trim().split('\r\n')).toHaveLength(502);
  expect(csv).toContain("'=FORMULA");
  const empty = await GET(new Request('http://localhost/api/admin/ai-costs/export?from=2026-09-15&to=2026-09-15&provider=kie'));
  expect((await empty.text()).trim().split('\r\n')).toHaveLength(1);
});
it('impide exportación sin administrador', async () => {
  vi.mocked(requireAdmin).mockRejectedValueOnce(new ForbiddenAdminError());
  expect((await GET(new Request('http://localhost/api/admin/ai-costs/export'))).status).toBe(403);
});
