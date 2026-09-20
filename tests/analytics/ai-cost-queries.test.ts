import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { queryAiCosts } from '@/server/analytics/ai-cost-queries';
import { recordAiAttempt } from '@/server/analytics/ai-cost-recorder';
import { resetDb } from '../helpers/db';

const RANGE = { from: new Date('2026-01-01'), to: new Date('2027-01-01') };

describe('costes IA operativos', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.aiRequestCost.deleteMany();
  });

  it('separa confirmado, estimado y desconocido sin convertir errores en cero', async () => {
    await prisma.aiRequestCost.createMany({ data: [
      row({ requestId: 'r1', attempt: 0, costType: 'confirmed', costUsd: 0.012, status: 'success' }),
      row({ requestId: 'r2', attempt: 0, costType: 'estimated', costUsd: 0.05, status: 'success' }),
      row({ requestId: 'r3', attempt: 0, costType: 'unknown', costUsd: null, status: 'error' }),
    ] });
    const report = await queryAiCosts({ ...RANGE, groupBy: 'project' });
    expect(report.totals.confirmedUsd).toBeCloseTo(0.012);
    expect(report.totals.estimatedUsd).toBeCloseTo(0.05);
    expect(report.totals.unknownAttempts).toBe(1);
    expect(report.totals.errors).toBe(1);
  });

  it('es idempotente por requestId + intento y conserva fallbacks distintos', async () => {
    const base = { organizationId: 'org', requestId: 'same', action: 'render3d' as const, operation: 'generate' as const, provider: 'kie', model: 'm1', status: 'error' as const, latencyMs: 10, costType: 'unknown' as const };
    await recordAiAttempt({ ...base, attempt: 0 });
    await recordAiAttempt({ ...base, attempt: 0 });
    await recordAiAttempt({ ...base, attempt: 1, provider: 'openai', model: 'm2' });
    expect(await prisma.aiRequestCost.count()).toBe(2);
  });

  it('filtra proveedor/estado y agrupa por referencia de diseño', async () => {
    await prisma.aiRequestCost.createMany({ data: [
      row({ requestId: 'a', attempt: 0, provider: 'openrouter', refId: 'design-a', status: 'success' }),
      row({ requestId: 'b', attempt: 0, provider: 'kie', refId: 'design-b', status: 'error', costType: 'unknown', costUsd: null }),
    ] });
    const report = await queryAiCosts({ ...RANGE, provider: 'kie', status: 'error', groupBy: 'design' });
    expect(report.groups.map((group) => group.key)).toEqual(['design-b']);
  });
  it('pagina detalle sin truncar totales y agrupa evolución/respaldos', async () => {
    await prisma.aiRequestCost.createMany({ data: Array.from({ length: 205 }, (_, index) =>
      row({ requestId: `r-${index}`, attempt: index === 204 ? 1 : 0, userId: 'usuario-test' })) });
    const report = await queryAiCosts({ ...RANGE, page: 2, interval: 'month', groupBy: 'user' });
    expect(report.details).toHaveLength(5);
    expect(report.totals.attempts).toBe(205);
    expect(report.pageCount).toBe(2);
    expect(report.timeline[0]).toMatchObject({ key: '2026-09', attempts: 205 });
    expect(report.groups[0]?.key).toBe('usuario-test');
    expect(report.fallbackAttempts).toBe(1);
  });
});

function row(overrides: Record<string, unknown>) {
  return {
    requestId: 'request', attempt: 0, organizationId: 'org', action: 'chat' as const,
    operation: 'chat', provider: 'openrouter', model: 'model', status: 'success', latencyMs: 20,
    units: { promptTokens: 10, completionTokens: 5 }, costUsd: 0.01, costType: 'estimated',
    createdAt: new Date('2026-09-15T10:00:00Z'), ...overrides,
  };
}
