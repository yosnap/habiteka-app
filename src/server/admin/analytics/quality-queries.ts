/**
 * Eficacia de la capa de calidad: cruza las evaluaciones de Jev con el gasto real
 * de IA para responder cuánto cuesta un resultado aceptado, cuánto se desperdicia
 * y cuánto se ahorra bloqueando antes de generar.
 *
 * Todo se agrega EN LA BASE DE DATOS (`$queryRaw` parametrizado y `groupBy`): el
 * informe no depende del número de filas del rango, así que un mes con millones
 * de evaluaciones no se trae a memoria.
 *
 * Tres reglas que hacen que las cifras signifiquen lo que dicen:
 *
 *  1. Ahorro = solo los bloqueos que REALMENTE cortaron una generación de pago
 *     (marca `gate: 'cut'` en la fila). Un plano puntuado bajo en el asistente,
 *     sin acción de pago detrás, es un «bloqueo informativo» y se cuenta aparte.
 *  2. Cada coste cae en UNA categoría, con prioridad rehecho > bloqueado >
 *     aceptado > sin evaluar, de modo que las cuatro suman el total.
 *  3. Una decisión reutilizada de la caché cuenta como paso de puerta (tiene su
 *     fila) pero no suma coste de Jev: solo las llamadas reales tienen coste.
 */
import { Prisma } from '@/generated/prisma/client';
import { PRE_GATE_CHECKPOINTS } from '@/lib/quality-checkpoint-labels';
import { prisma } from '@/server/db/prisma';

export interface QualityFilters {
  from: Date;
  to: Date;
}

export interface QualityCheckpointRow {
  checkpoint: string;
  /** Decisiones registradas (una por paso de puerta), reutilizaciones incluidas. */
  evaluations: number;
  proceed: number;
  confirm: number;
  block: number;
  /** Evaluaciones que no pudo puntuar Jev (política de fallo): `failOpen=false`. */
  unevaluated: number;
  /** Decisiones servidas desde la caché por evidencia: sin llamada ni coste. */
  reused: number;
  /** Bloqueos que cortaron una generación de pago concreta. */
  blockedCut: number;
  /** Bloqueos sin gasto detrás (informativos). */
  blockedInformative: number;
  avgScore: number | null;
  jevCostUsd: number;
}

export interface QualitySavingRow {
  checkpoint: string;
  /** Bloqueos que cortaron gasto (no los informativos). */
  blocked: number;
  /** Coste medio de la generación que ese bloqueo evitó. */
  avgGenerationUsd: number;
  avoidedUsd: number;
}

/** Bloqueos que no cortaron ninguna acción de pago: información, no ahorro. */
export interface QualityInformativeRow {
  checkpoint: string;
  blocked: number;
}

export interface QualityProviderRow {
  key: string;
  provider: string;
  model: string;
  attempts: number;
  costUsd: number;
  /** Resultados suyos con una evaluación posterior puntuada. */
  scored: number;
  avgScore: number | null;
}

export interface QualityEfficacyReport {
  checkpoints: QualityCheckpointRow[];
  savings: QualitySavingRow[];
  informative: QualityInformativeRow[];
  providers: QualityProviderRow[];
  totals: Omit<QualityCheckpointRow, 'checkpoint'>;
  cost: {
    totalUsd: number;
    acceptedUsd: number;
    blockedUsd: number;
    iteratedUsd: number;
    /** Entregado sin evaluación posterior: no se puede atribuir a ninguna banda. */
    unscoredUsd: number;
    wastedUsd: number;
    avoidedUsd: number;
    jevCostUsd: number;
    balanceUsd: number;
  };
  estimateBasis: {
    avgGenerationUsd: number;
    avgIterationUsd: number;
    generations: number;
    iterations: number;
  };
  hasData: boolean;
}

/** Acciones que producen un entregable de pago (su media estima lo evitado). */
const GENERATION_ACTIONS = ['render3d', 'plano2d', 'memoria'];
const ITERATION_ACTIONS = ['inpaint'];

export async function queryQualityEfficacy(
  filters: QualityFilters,
): Promise<QualityEfficacyReport> {
  const { from, to } = filters;
  const [checkpointRows, costBuckets, basis, providerCosts, providerScores] = await Promise.all([
    queryCheckpointGroups(from, to),
    queryCostBuckets(from, to),
    queryEstimateBasis(from, to),
    queryProviderCosts(from, to),
    queryProviderScores(from, to),
  ]);

  const checkpoints = foldCheckpoints(checkpointRows);
  const savings = buildSavings(checkpoints, basis);
  // Solo las puertas PREVIAS pueden cortar gasto: un bloqueo posterior puntúa
  // algo ya pagado y no es ni ahorro ni bloqueo informativo de puerta.
  const informative = checkpoints
    .filter(
      (row) =>
        row.blockedInformative > 0 &&
        (PRE_GATE_CHECKPOINTS as readonly string[]).includes(row.checkpoint),
    )
    .map((row) => ({ checkpoint: row.checkpoint, blocked: row.blockedInformative }));
  const avoidedUsd = savings.reduce((total, row) => total + row.avoidedUsd, 0);
  const jevCostUsd = checkpoints.reduce((total, row) => total + row.jevCostUsd, 0);

  return {
    checkpoints,
    savings,
    informative,
    providers: buildProviders(providerCosts, providerScores),
    totals: totalsOf(checkpoints, checkpointRows),
    cost: {
      ...costBuckets,
      wastedUsd: costBuckets.blockedUsd + costBuckets.iteratedUsd,
      avoidedUsd,
      jevCostUsd,
      balanceUsd: avoidedUsd - jevCostUsd,
    },
    estimateBasis: basis,
    hasData:
      checkpointRows.length > 0 || costBuckets.totalUsd > 0 || basis.generations + basis.iterations > 0,
  };
}

// ── Consultas agregadas ───────────────────────────────────────────────────────

interface CheckpointGroup {
  checkpoint: string;
  decision: string;
  gate: string | null;
  reused: boolean;
  n: number;
  unevaluated: number;
  scored: number;
  score_sum: number;
  cost: number;
}

/**
 * Una fila por (punto de control, decisión, marca de puerta, reutilización). La
 * marca vive dentro del JSON `answers`, así que se extrae en SQL.
 */
async function queryCheckpointGroups(from: Date, to: Date): Promise<CheckpointGroup[]> {
  return prisma.$queryRaw<CheckpointGroup[]>`
    SELECT
      checkpoint,
      decision,
      (answers -> '_gate' ->> 'gate') AS gate,
      COALESCE((answers -> '_gate' ->> 'reused')::boolean, false) AS reused,
      COUNT(*)::int AS n,
      SUM(CASE WHEN "failOpen" THEN 0 ELSE 1 END)::int AS unevaluated,
      COUNT(score)::int AS scored,
      COALESCE(SUM(score), 0)::float8 AS score_sum,
      COALESCE(SUM("costUsd"), 0)::float8 AS cost
    FROM "ai_quality_evaluation"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1, 2, 3, 4
  `;
}

interface CostBucketRow {
  total: number;
  accepted: number;
  blocked: number;
  iterated: number;
  unscored: number;
}

/**
 * Reparto del gasto por referencia en categorías EXCLUYENTES. Prioridad:
 * rehecho (hubo que iterarlo) > bloqueado > aceptado > sin evaluar. Así las
 * cuatro suman exactamente el total imputable a entregables.
 */
async function queryCostBuckets(from: Date, to: Date) {
  const preGate = Prisma.join([...PRE_GATE_CHECKPOINTS]);
  const rows = await prisma.$queryRaw<CostBucketRow[]>`
    WITH gasto AS (
      SELECT "refId", SUM("costUsd") AS amount
      FROM "ai_request_cost"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND "refId" IS NOT NULL
      GROUP BY "refId"
    ),
    veredicto AS (
      SELECT DISTINCT ON ("refId") "refId", decision
      FROM "ai_quality_evaluation"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "refId" IS NOT NULL
        AND checkpoint NOT IN (${preGate})
      ORDER BY "refId", "createdAt" DESC
    ),
    rehecho AS (SELECT DISTINCT "deliverableId" FROM "iteration")
    SELECT
      COALESCE(SUM(g.amount), 0)::float8 AS total,
      COALESCE(SUM(CASE WHEN r."deliverableId" IS NULL AND v.decision IN ('proceed', 'confirm')
                        THEN g.amount ELSE 0 END), 0)::float8 AS accepted,
      COALESCE(SUM(CASE WHEN r."deliverableId" IS NULL AND v.decision = 'block'
                        THEN g.amount ELSE 0 END), 0)::float8 AS blocked,
      COALESCE(SUM(CASE WHEN r."deliverableId" IS NOT NULL THEN g.amount ELSE 0 END), 0)::float8 AS iterated,
      COALESCE(SUM(CASE WHEN r."deliverableId" IS NULL AND v.decision IS NULL
                        THEN g.amount ELSE 0 END), 0)::float8 AS unscored
    FROM gasto g
    LEFT JOIN veredicto v ON v."refId" = g."refId"
    LEFT JOIN rehecho r ON r."deliverableId" = g."refId"
  `;
  const row = rows[0];
  return {
    totalUsd: row?.total ?? 0,
    acceptedUsd: row?.accepted ?? 0,
    blockedUsd: row?.blocked ?? 0,
    iteratedUsd: row?.iterated ?? 0,
    unscoredUsd: row?.unscored ?? 0,
  };
}

interface BasisRow {
  kind: string;
  requests: number;
  cost: number;
}

async function queryEstimateBasis(
  from: Date,
  to: Date,
): Promise<QualityEfficacyReport['estimateBasis']> {
  const rows = await prisma.$queryRaw<BasisRow[]>`
    SELECT
      CASE WHEN action IN (${Prisma.join(GENERATION_ACTIONS)}) THEN 'generacion' ELSE 'iteracion' END AS kind,
      COUNT(DISTINCT "requestId")::int AS requests,
      COALESCE(SUM("costUsd"), 0)::float8 AS cost
    FROM "ai_request_cost"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND action IN (${Prisma.join([...GENERATION_ACTIONS, ...ITERATION_ACTIONS])})
    GROUP BY 1
  `;
  const pick = (kind: string) => rows.find((row) => row.kind === kind);
  const generation = pick('generacion');
  const iteration = pick('iteracion');
  return {
    avgGenerationUsd: generation?.requests ? generation.cost / generation.requests : 0,
    avgIterationUsd: iteration?.requests ? iteration.cost / iteration.requests : 0,
    generations: generation?.requests ?? 0,
    iterations: iteration?.requests ?? 0,
  };
}

interface ProviderCostRow {
  provider: string;
  model: string;
  attempts: number;
  cost: number;
}

async function queryProviderCosts(from: Date, to: Date): Promise<ProviderCostRow[]> {
  return prisma.$queryRaw<ProviderCostRow[]>`
    SELECT provider, model, COUNT(*)::int AS attempts, COALESCE(SUM("costUsd"), 0)::float8 AS cost
    FROM "ai_request_cost"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1, 2
  `;
}

interface ProviderScoreRow {
  provider: string;
  model: string;
  scored: number;
  avg_score: number | null;
}

/** Score medio por proveedor sobre entregables DISTINTOS (no por intento). */
async function queryProviderScores(from: Date, to: Date): Promise<ProviderScoreRow[]> {
  const preGate = Prisma.join([...PRE_GATE_CHECKPOINTS]);
  return prisma.$queryRaw<ProviderScoreRow[]>`
    WITH puntuado AS (
      SELECT DISTINCT ON ("refId") "refId", score
      FROM "ai_quality_evaluation"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "refId" IS NOT NULL AND score IS NOT NULL
        AND checkpoint NOT IN (${preGate})
      ORDER BY "refId", "createdAt" DESC
    ),
    por_entregable AS (
      SELECT DISTINCT c.provider, c.model, c."refId", p.score
      FROM "ai_request_cost" c
      JOIN puntuado p ON p."refId" = c."refId"
      WHERE c."createdAt" >= ${from} AND c."createdAt" <= ${to}
    )
    SELECT provider, model, COUNT(*)::int AS scored, AVG(score)::float8 AS avg_score
    FROM por_entregable
    GROUP BY 1, 2
  `;
}

// ── Composición del informe ───────────────────────────────────────────────────

function foldCheckpoints(rows: CheckpointGroup[]): QualityCheckpointRow[] {
  const byCheckpoint = new Map<string, QualityCheckpointRow & { scoreSum: number; scored: number }>();
  for (const row of rows) {
    const current =
      byCheckpoint.get(row.checkpoint) ??
      {
        checkpoint: row.checkpoint, evaluations: 0, proceed: 0, confirm: 0, block: 0,
        unevaluated: 0, reused: 0, blockedCut: 0, blockedInformative: 0,
        avgScore: null, jevCostUsd: 0, scoreSum: 0, scored: 0,
      };
    current.evaluations += row.n;
    if (row.decision === 'proceed') current.proceed += row.n;
    else if (row.decision === 'block') {
      current.block += row.n;
      // Solo cuenta como ahorro el bloqueo que cortó una acción de pago.
      if (row.gate === 'cut') current.blockedCut += row.n;
      else current.blockedInformative += row.n;
    } else current.confirm += row.n;
    if (row.reused) current.reused += row.n;
    current.unevaluated += row.unevaluated;
    current.scoreSum += row.score_sum;
    current.scored += row.scored;
    current.jevCostUsd += row.cost;
    byCheckpoint.set(row.checkpoint, current);
  }
  return [...byCheckpoint.values()]
    .map(({ scoreSum, scored, ...row }) => ({
      ...row,
      avgScore: scored ? scoreSum / scored : null,
    }))
    .sort((a, b) => b.evaluations - a.evaluations);
}

function totalsOf(
  checkpoints: QualityCheckpointRow[],
  rows: CheckpointGroup[],
): Omit<QualityCheckpointRow, 'checkpoint'> {
  const scored = rows.reduce((n, row) => n + row.scored, 0);
  const scoreSum = rows.reduce((n, row) => n + row.score_sum, 0);
  const sum = (pick: (row: QualityCheckpointRow) => number) =>
    checkpoints.reduce((n, row) => n + pick(row), 0);
  return {
    evaluations: sum((row) => row.evaluations),
    proceed: sum((row) => row.proceed),
    confirm: sum((row) => row.confirm),
    block: sum((row) => row.block),
    unevaluated: sum((row) => row.unevaluated),
    reused: sum((row) => row.reused),
    blockedCut: sum((row) => row.blockedCut),
    blockedInformative: sum((row) => row.blockedInformative),
    jevCostUsd: sum((row) => row.jevCostUsd),
    avgScore: scored ? scoreSum / scored : null,
  };
}

function buildSavings(
  checkpoints: QualityCheckpointRow[],
  basis: QualityEfficacyReport['estimateBasis'],
): QualitySavingRow[] {
  return PRE_GATE_CHECKPOINTS.map((checkpoint) => {
    const blocked = checkpoints.find((row) => row.checkpoint === checkpoint)?.blockedCut ?? 0;
    const avgGenerationUsd =
      checkpoint === 'change_instruction' ? basis.avgIterationUsd : basis.avgGenerationUsd;
    return { checkpoint, blocked, avgGenerationUsd, avoidedUsd: blocked * avgGenerationUsd };
  }).filter((row) => row.blocked > 0);
}

function buildProviders(
  costs: ProviderCostRow[],
  scores: ProviderScoreRow[],
): QualityProviderRow[] {
  return costs
    .map((row) => {
      const score = scores.find((item) => item.provider === row.provider && item.model === row.model);
      return {
        key: `${row.provider}/${row.model}`,
        provider: row.provider,
        model: row.model,
        attempts: row.attempts,
        costUsd: row.cost,
        scored: score?.scored ?? 0,
        avgScore: score?.avg_score ?? null,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}
