import { expect, it } from 'vitest';
import { csvCell } from '@/lib/ai-cost-csv';
import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import { chatAttemptCost } from '@/server/ai/cost/chat-attempt-cost';
import { toTokenUsage } from '@/server/ai/cost/usage-to-cost';

it('solo trata como confirmado el coste reportado en USD por proveedor compatible', () => {
  expect(chatAttemptCost(toTokenUsage({ cost: .002 }, true))).toEqual({ costUsd: .002, costType: 'confirmed' });
  expect(chatAttemptCost(toTokenUsage({ cost: 0 }, true))).toEqual({ costUsd: 0, costType: 'confirmed' });
  expect(chatAttemptCost(toTokenUsage({ cost: .002 }))).toEqual({ costType: 'unknown' });
  expect(chatAttemptCost(toTokenUsage({ cost: -1 }, true))).toEqual({ costType: 'unknown' });
  expect(chatAttemptCost()).toEqual({ costType: 'unknown' });
});
it('escapa CSV y neutraliza fórmulas', () => {
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
  expect(csvCell('a,"b"')).toBe('"a,""b"""');
  expect(csvCell(null)).toBe('""');
});
it('normaliza paginación y comparte filtros exportación', () => {
  expect(aiCostFilterParams(new URLSearchParams('groupBy=user&interval=month&page=-4&provider=kie'))).toMatchObject({
    groupBy: 'user', interval: 'month', page: 1, provider: 'kie' });
});
