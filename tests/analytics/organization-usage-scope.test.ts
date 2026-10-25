import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ rows: vi.fn(), raw: vi.fn() }));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  aiRequestCost: { findMany: db.rows },
  project: { findMany: async () => [] },
  user: { findMany: async () => [] },
  $queryRaw: db.raw,
} }));
import { queryAiCosts } from '@/server/analytics/ai-cost-queries';
import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import { queryQualityEfficacy } from '@/server/admin/analytics/quality-queries';

const from = new Date('2026-10-01T00:00:00Z'), to = new Date('2026-10-24T23:59:59Z');
const row = (over: Record<string, unknown>) => ({ id: 'r', createdAt: new Date('2026-10-02T10:00:00Z'), requestId: 'q', attempt: 0, action: 'chat', provider: 'openrouter',
  model: 'm', status: 'success', batchId: null, refId: null, costUsd: 0.1, costType: 'confirmed', userId: null, projectId: null, errorCode: null, latencyMs: 100, units: null, ...over });
// Prisma anida cada fragmento SQL: se aplana para ver el texto y los parámetros que llegan a la base.
type Fragment = { strings: readonly string[]; values: unknown[] };
const isFragment = (value: unknown): value is Fragment => !!value && typeof value === 'object' && 'strings' in value && 'values' in value;
function flatten(strings: readonly string[], values: unknown[]): { text: string; params: unknown[] } {
  let text = strings[0] ?? '';
  const params: unknown[] = [];
  values.forEach((value, index) => {
    if (isFragment(value)) { const inner = flatten(value.strings, value.values); text += inner.text; params.push(...inner.params); }
    else { text += '?'; params.push(value); }
    text += strings[index + 1] ?? '';
  });
  return { text, params };
}
beforeEach(() => { vi.resetAllMocks(); db.rows.mockResolvedValue([]); db.raw.mockResolvedValue([]); });

describe('uso y costes limitados a una organización', () => {
  it('el informe de costes filtra por organización tanto los registros como las opciones', async () => {
    await queryAiCosts({ from, to, organizationId: 'org-a' });
    for (const [args] of db.rows.mock.calls) expect(args.where).toMatchObject({ organizationId: 'org-a' });
  });

  it('sin organización, el panel global consulta toda la plataforma', async () => {
    await queryAiCosts({ from, to });
    for (const [args] of db.rows.mock.calls) expect(args.where).not.toHaveProperty('organizationId');
  });

  it('agrupa por función y cuenta los errores por código', async () => {
    db.rows.mockResolvedValueOnce([row({ action: 'chat' }), row({ id: 'e1', action: 'render3d', status: 'error', errorCode: 'missing_key', costUsd: null, costType: 'unknown' }),
      row({ id: 'e2', action: 'render3d', status: 'error', errorCode: 'missing_key', costUsd: null, costType: 'unknown' })]).mockResolvedValueOnce([]);
    const report = await queryAiCosts({ from, to, organizationId: 'org-a', groupBy: 'action' });
    expect(report.groups.map((group) => group.key).sort()).toEqual(['chat', 'render3d']);
    expect(report.errorCodes).toEqual([{ code: 'missing_key', count: 2 }]);
  });

  it('el informe de eficacia pasa la organización como parámetro en todas sus consultas', async () => {
    await queryQualityEfficacy({ from, to, organizationId: 'org-a' });
    expect(db.raw).toHaveBeenCalledTimes(5);
    for (const [sql, ...values] of db.raw.mock.calls) {
      const { text, params } = flatten(sql, values);
      expect(params).toContain('org-a');
      expect(text).toContain('"organizationId" = ?');
      expect(text).not.toContain('org-a');
    }
  });

  it('sin organización, la eficacia no añade condición de organización', async () => {
    await queryQualityEfficacy({ from, to });
    for (const [sql, ...values] of db.raw.mock.calls) expect(flatten(sql, values).text).not.toContain('"organizationId" =');
  });

  it('el filtro de la URL solo acepta ids con forma válida', () => {
    expect(aiCostFilterParams(new URLSearchParams('org=org_1-a')).organizationId).toBe('org_1-a');
    expect(aiCostFilterParams(new URLSearchParams("org=x' OR 1=1")).organizationId).toBeUndefined();
    expect(aiCostFilterParams(new URLSearchParams('groupBy=action')).groupBy).toBe('action');
  });
});
