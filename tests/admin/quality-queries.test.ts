/**
 * Panel de eficacia: cruce de evaluaciones de Jev con el gasto real de IA.
 *
 * Se comprueba con datos sembrados: bandas por punto de control, evaluaciones que
 * Jev no pudo puntuar, reparto EXCLUYENTE del gasto (rehecho > bloqueado >
 * aceptado > sin evaluar), ahorro estimado solo por los bloqueos que cortaron
 * una generación de pago, bloqueos informativos y comparativa por proveedor.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { queryQualityEfficacy } from '@/server/admin/analytics/quality-queries';
import { qualityFilterParams } from '@/server/admin/analytics/quality-filter-params';
import { DELIVERABLE_LEGAL_SEAL } from '@/server/agent/legal/seal';
import { prisma } from '@/server/db/prisma';
import { makeOrg, resetDb } from '../helpers/db';

const RANGE = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-30T23:59:59Z') };
const AT = new Date('2026-09-10T10:00:00Z');

async function evaluation(data: {
  checkpoint: string;
  decision: string;
  score: number | null;
  refId?: string;
  failOpen?: boolean;
  costUsd?: string;
  /** Marca de puerta: `cut` = cortó una acción de pago; `info` = informativa. */
  gate?: 'cut' | 'passed' | 'info';
  reused?: boolean;
}) {
  await prisma.aiQualityEvaluation.create({
    data: {
      organizationId: 'org-panel',
      checkpoint: data.checkpoint,
      decision: data.decision,
      score: data.score,
      refId: data.refId ?? null,
      answers: data.gate
        ? { _gate: { gate: data.gate, action: 'accion_x', ...(data.reused ? { reused: true } : {}) } }
        : {},
      reasons: [],
      evidenceHash: `hash-${Math.random()}`,
      costUsd: data.costUsd ?? '0.00010000',
      failOpen: data.failOpen ?? true,
      errorCode: (data.failOpen ?? true) ? null : 'network',
      createdAt: AT,
    },
  });
}

async function cost(data: {
  refId?: string;
  action: 'render3d' | 'plano2d' | 'memoria' | 'inpaint';
  costUsd: string;
  provider?: string;
  requestId: string;
}) {
  await prisma.aiRequestCost.create({
    data: {
      requestId: data.requestId,
      attempt: 0,
      organizationId: 'org-panel',
      refId: data.refId ?? null,
      action: data.action,
      operation: data.action,
      provider: data.provider ?? 'kie',
      model: 'modelo-x',
      status: 'success',
      latencyMs: 10,
      costUsd: data.costUsd,
      costType: 'confirmed',
      createdAt: AT,
    },
  });
}

describe('eficacia de la calidad', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.aiQualityEvaluation.deleteMany();
    await prisma.aiRequestCost.deleteMany();
  });

  it('informa de un rango vacío sin inventar datos', async () => {
    const report = await queryQualityEfficacy(RANGE);
    expect(report.hasData).toBe(false);
    expect(report.checkpoints).toEqual([]);
    expect(report.cost.avoidedUsd).toBe(0);
  });

  it('reparte decisiones por punto de control y marca las no evaluadas', async () => {
    await evaluation({ checkpoint: 'memoria_result', decision: 'proceed', score: 90, refId: 'd1' });
    await evaluation({ checkpoint: 'memoria_result', decision: 'confirm', score: 70, refId: 'd2' });
    await evaluation({ checkpoint: 'memoria_result', decision: 'confirm', score: null, failOpen: false });

    const report = await queryQualityEfficacy(RANGE);
    const row = report.checkpoints.find((item) => item.checkpoint === 'memoria_result');
    expect(row).toMatchObject({ evaluations: 3, proceed: 1, confirm: 2, block: 0, unevaluated: 1 });
    expect(row?.avgScore).toBe(80);
    expect(report.totals.evaluations).toBe(3);
  });

  it('separa coste aceptado de gasto desperdiciado (bloqueado o rehecho)', async () => {
    const orgId = await makeOrg(100);
    const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
    const iterated = await prisma.deliverable.create({
      data: {
        projectId: project.id, type: 'RENDER_3D', version: 1, legalSeal: DELIVERABLE_LEGAL_SEAL,
        payload: { type: 'render3d', assetUrl: 'https://cdn/a.png' },
      },
    });
    await prisma.iteration.create({
      data: { deliverableId: iterated.id, zone: {}, instruction: 'más luz', resultRef: 'v2' },
    });

    await cost({ refId: 'aceptado', action: 'render3d', costUsd: '0.10000000', requestId: 'r1' });
    await cost({ refId: 'bloqueado', action: 'render3d', costUsd: '0.20000000', requestId: 'r2' });
    await cost({ refId: iterated.id, action: 'render3d', costUsd: '0.30000000', requestId: 'r3' });
    await evaluation({ checkpoint: 'render_result', decision: 'proceed', score: 92, refId: 'aceptado' });
    await evaluation({ checkpoint: 'render_result', decision: 'block', score: 30, refId: 'bloqueado' });
    await evaluation({ checkpoint: 'render_result', decision: 'proceed', score: 88, refId: iterated.id });

    const report = await queryQualityEfficacy(RANGE);
    expect(report.cost.totalUsd).toBeCloseTo(0.6, 8);
    // Cada coste cae en UNA categoría: el rehecho NO se cuenta además como
    // aceptado. Las cuatro categorías suman el total.
    expect(report.cost.acceptedUsd).toBeCloseTo(0.1, 8);
    expect(report.cost.blockedUsd).toBeCloseTo(0.2, 8);
    expect(report.cost.iteratedUsd).toBeCloseTo(0.3, 8);
    expect(report.cost.unscoredUsd).toBeCloseTo(0, 8);
    expect(report.cost.wastedUsd).toBeCloseTo(0.5, 8);
    expect(
      report.cost.acceptedUsd +
        report.cost.blockedUsd +
        report.cost.iteratedUsd +
        report.cost.unscoredUsd,
    ).toBeCloseTo(report.cost.totalUsd, 8);
  });

  it('un gasto sin evaluación posterior queda en «sin evaluar», no en aceptado', async () => {
    await cost({ refId: 'huerfano', action: 'render3d', costUsd: '0.07000000', requestId: 'r9' });

    const report = await queryQualityEfficacy(RANGE);
    expect(report.cost.unscoredUsd).toBeCloseTo(0.07, 8);
    expect(report.cost.acceptedUsd).toBe(0);
  });

  it('estima el ahorro de las puertas previas con el coste medio por petición', async () => {
    await cost({ refId: 'g1', action: 'render3d', costUsd: '0.20000000', requestId: 'r1' });
    await cost({ refId: 'g2', action: 'plano2d', costUsd: '0.10000000', requestId: 'r2' });
    await cost({ refId: 'g3', action: 'inpaint', costUsd: '0.04000000', requestId: 'r3' });
    // Solo estos dos cortaron una generación de pago.
    await evaluation({ checkpoint: 'plan_extraction', decision: 'block', score: 40, gate: 'cut' });
    await evaluation({ checkpoint: 'plan_extraction', decision: 'proceed', score: 95, gate: 'passed' });
    // Bloqueo informativo: el asistente puntuó el plano, pero nadie iba a gastar.
    await evaluation({ checkpoint: 'plan_extraction', decision: 'block', score: 35, gate: 'info' });
    await evaluation({ checkpoint: 'change_instruction', decision: 'block', score: 20, gate: 'cut' });
    await evaluation({ checkpoint: 'render_result', decision: 'block', score: 10, refId: 'sin-coste' });

    const report = await queryQualityEfficacy(RANGE);
    expect(report.estimateBasis.avgGenerationUsd).toBeCloseTo(0.15, 8);
    expect(report.estimateBasis.avgIterationUsd).toBeCloseTo(0.04, 8);
    // Solo las puertas PREVIAS ahorran: el bloqueo del resultado ya está pagado.
    expect(report.savings.map((row) => row.checkpoint)).toEqual([
      'plan_extraction',
      'change_instruction',
    ]);
    expect(report.savings.map((row) => row.blocked)).toEqual([1, 1]);
    expect(report.cost.avoidedUsd).toBeCloseTo(0.19, 8);
    expect(report.cost.balanceUsd).toBeCloseTo(0.19 - report.cost.jevCostUsd, 8);
    // El bloqueo sin gasto detrás no infla el ahorro: se lista aparte.
    expect(report.informative).toEqual([{ checkpoint: 'plan_extraction', blocked: 1 }]);
    const plan = report.checkpoints.find((row) => row.checkpoint === 'plan_extraction');
    expect(plan).toMatchObject({ block: 2, blockedCut: 1, blockedInformative: 1 });
  });

  it('cuenta las decisiones reutilizadas sin sumar coste de Jev', async () => {
    await evaluation({ checkpoint: 'editor_structure', decision: 'proceed', score: 95, gate: 'passed', costUsd: '0.00020000' });
    await evaluation({ checkpoint: 'editor_structure', decision: 'proceed', score: 95, gate: 'passed', reused: true, costUsd: '0.00000000' });

    const report = await queryQualityEfficacy(RANGE);
    const row = report.checkpoints.find((item) => item.checkpoint === 'editor_structure');
    expect(row).toMatchObject({ evaluations: 2, proceed: 2, reused: 1 });
    expect(row?.jevCostUsd).toBeCloseTo(0.0002, 8);
  });

  it('compara proveedores con el score medio de sus resultados', async () => {
    await cost({ refId: 'd1', action: 'render3d', costUsd: '0.20000000', requestId: 'r1', provider: 'kie' });
    await cost({ refId: 'd2', action: 'render3d', costUsd: '0.05000000', requestId: 'r2', provider: 'nan' });
    await evaluation({ checkpoint: 'render_result', decision: 'proceed', score: 90, refId: 'd1' });
    await evaluation({ checkpoint: 'render_result', decision: 'block', score: 30, refId: 'd2' });

    const report = await queryQualityEfficacy(RANGE);
    expect(report.providers[0]).toMatchObject({ provider: 'kie', attempts: 1, scored: 1, avgScore: 90 });
    expect(report.providers[1]).toMatchObject({ provider: 'nan', avgScore: 30 });
  });

  it('excluye lo que cae fuera del rango de fechas pedido', async () => {
    await evaluation({ checkpoint: 'render_result', decision: 'proceed', score: 90, refId: 'd1' });
    const filters = qualityFilterParams(new URLSearchParams('from=2026-08-01&to=2026-08-31'));
    expect((await queryQualityEfficacy(filters)).hasData).toBe(false);
  });
});
