/**
 * La evaluación POSTERIOR no puede hacer esperar a la entrega.
 *
 * Se comprueba que los entregables se puntúan EN PARALELO y con un presupuesto
 * TOTAL: tres evaluaciones lentas no suman tres esperas, y si el presupuesto se
 * agota la entrega sigue adelante sin lanzar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({ evaluate: vi.fn(), reuse: vi.fn() }));

vi.mock('@/server/quality/evaluate', () => ({
  evaluateCheckpoint: mocks.evaluate,
  evaluateCheckpointCached: mocks.evaluate,
  recordReusedEvaluation: mocks.reuse,
  evidenceHashOf: () => 'hash',
}));

import type { Deliverable } from '@/lib/contracts';
import { evaluateDeliverableResults, RESULT_BUDGET_MS } from '@/server/quality/result-gate';

const CTX = { organizationId: 'org-1', userId: 'user-1' };

function memoria(id: string): Deliverable {
  return {
    id,
    type: 'memoria',
    legalSeal: 'sello',
    version: 1,
    payload: { type: 'memoria', markdown: '# Memoria\n## Suelo: roble.' },
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => vi.clearAllMocks());

describe('evaluación posterior en paralelo', () => {
  it('no suma las esperas: tres entregables tardan como uno', async () => {
    mocks.evaluate.mockImplementation(async () => {
      await wait(120);
      return { score: 90, decision: 'proceed', confidence: null, reasons: [], failOpen: true };
    });

    const started = Date.now();
    const recorded = await evaluateDeliverableResults(CTX, {
      projectId: 'p1',
      deliverables: [memoria('d1'), memoria('d2'), memoria('d3')],
      memoriaContext: { estilo: 'moderno', objetivo: 'reformar' },
    });

    expect(recorded).toBe(3);
    expect(mocks.evaluate).toHaveBeenCalledTimes(3);
    // En serie serían ≥360 ms; en paralelo, poco más de una espera.
    expect(Date.now() - started).toBeLessThan(330);
  });

  it('un fallo al puntuar no rompe la entrega ni impide puntuar al resto', async () => {
    mocks.evaluate
      .mockRejectedValueOnce(new Error('Jev caído'))
      .mockResolvedValue({ score: 80, decision: 'confirm', confidence: null, reasons: [], failOpen: true });

    await expect(
      evaluateDeliverableResults(CTX, {
        projectId: 'p1',
        deliverables: [memoria('d1'), memoria('d2')],
      }),
    ).resolves.toBe(1);
  });

  it('el presupuesto es total y acotado: nunca bloquea la entrega indefinidamente', async () => {
    expect(RESULT_BUDGET_MS).toBeLessThanOrEqual(10_000);
    mocks.evaluate.mockImplementation(() => new Promise(() => undefined));

    const started = Date.now();
    vi.useFakeTimers();
    const pending = evaluateDeliverableResults(CTX, {
      projectId: 'p1',
      deliverables: [memoria('d1'), memoria('d2')],
    });
    await vi.advanceTimersByTimeAsync(RESULT_BUDGET_MS + 10);
    await expect(pending).resolves.toBe(0);
    vi.useRealTimers();
    expect(Date.now() - started).toBeLessThan(RESULT_BUDGET_MS);
  });
});
