import type { ModelAction, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';

export interface AiCostFilters {
  from: Date;
  to: Date;
  provider?: string;
  model?: string;
  status?: 'success' | 'error';
  groupBy?: 'project' | 'design' | 'provider' | 'model' | 'user';
  page?: number;
  interval?: 'day' | 'month';
}

export interface AiCostGroup {
  key: string;
  label: string;
  attempts: number;
  successes: number;
  errors: number;
  confirmedUsd: number;
  estimatedUsd: number;
  unknownAttempts: number;
  latencyMs: number;
}

export interface AiCostReport {
  groups: AiCostGroup[];
  totals: Omit<AiCostGroup, 'key' | 'label'>;
  providers: string[];
  models: string[];
  details: AiCostDetail[];
  detailLimit: number;
  detailTotal: number;
  page: number;
  pageCount: number;
  timeline: AiCostGroup[];
  requests: number;
  fallbackAttempts: number;
}

export interface AiCostDetail {
  id: string;
  createdAt: Date;
  requestId: string;
  attempt: number;
  action: string;
  provider: string;
  model: string;
  status: string;
  batchId: string | null;
  refId: string | null;
  costUsd: number | null;
  costType: string;
  userId: string | null;
  projectId: string | null;
  errorCode: string | null;
  latencyMs: number;
  units: Prisma.JsonValue;
}

const DETAIL_LIMIT = 200;

export async function queryAiCosts(filters: AiCostFilters): Promise<AiCostReport> {
  const where: Prisma.AiRequestCostWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [rows, optionRows] = await Promise.all([
    prisma.aiRequestCost.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    prisma.aiRequestCost.findMany({
      where: { createdAt: { gte: filters.from, lte: filters.to } },
      distinct: ['provider', 'model'], select: { provider: true, model: true },
    }),
  ]);
  const projectIds = [...new Set(rows.flatMap((row) => row.projectId ? [row.projectId] : []))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } }) : [];
  const titles = new Map(projects.map((project) => [project.id, project.title]));
  const userIds = [...new Set(rows.flatMap(row => row.userId ? [row.userId] : []))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map(user => [user.id, user.name]));
  const grouped = new Map<string, AiCostGroup>();
  const timeline = new Map<string, AiCostGroup>();
  for (const row of rows) {
    const key = filters.groupBy === 'provider' ? row.provider : filters.groupBy === 'model' ? `${row.provider}/${row.model}`
      : filters.groupBy === 'user' ? row.userId ?? 'Sin usuario asociado'
      : filters.groupBy === 'design' ? row.refId ?? 'Sin diseño asociado' : row.projectId ?? 'Sin proyecto asociado';
    const label = filters.groupBy === 'user' ? names.get(key) || key
      : !filters.groupBy || filters.groupBy === 'project' ? titles.get(key) ?? key : key;
    const group = grouped.get(key) ?? emptyGroup(key, label);
    group.attempts += 1;
    group.successes += row.status === 'success' ? 1 : 0;
    group.errors += row.status === 'error' ? 1 : 0;
    group.latencyMs += row.latencyMs;
    if (row.costType === 'confirmed') group.confirmedUsd += Number(row.costUsd ?? 0);
    if (row.costType === 'estimated') group.estimatedUsd += Number(row.costUsd ?? 0);
    if (row.costType === 'unknown') group.unknownAttempts += 1;
    grouped.set(key, group);
    const date = row.createdAt.toISOString().slice(0, filters.interval === 'month' ? 7 : 10);
    const point = timeline.get(date) ?? emptyGroup(date, date);
    addGroup(point, { ...emptyGroup(date, date), attempts: 1, successes: row.status === 'success' ? 1 : 0,
      errors: row.status === 'error' ? 1 : 0, latencyMs: row.latencyMs,
      confirmedUsd: row.costType === 'confirmed' ? Number(row.costUsd ?? 0) : 0,
      estimatedUsd: row.costType === 'estimated' ? Number(row.costUsd ?? 0) : 0,
      unknownAttempts: row.costType === 'unknown' ? 1 : 0 });
    timeline.set(date, point);
  }
  const groups = [...grouped.values()].sort((a, b) => (b.confirmedUsd + b.estimatedUsd) - (a.confirmedUsd + a.estimatedUsd));
  const pageCount = Math.max(1, Math.ceil(rows.length / DETAIL_LIMIT));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(filters.page ?? 1) || 1));
  return {
    page, pageCount, timeline: [...timeline.values()].sort((a, b) => a.key.localeCompare(b.key)),
    requests: new Set(rows.map(row => row.requestId)).size,
    fallbackAttempts: rows.filter(row => row.attempt > 0).length,
    groups,
    totals: groups.reduce((total, group) => addGroup(total, group), emptyTotals()),
    providers: [...new Set(optionRows.map((row) => row.provider))].sort(),
    models: [...new Set(optionRows.map((row) => row.model))].sort(),
    // El límite afecta solo al detalle. Los totales/grupos anteriores usan todas
    // las filas filtradas y por tanto nunca quedan truncados silenciosamente.
    details: rows.slice((page - 1) * DETAIL_LIMIT, page * DETAIL_LIMIT).map((row) => ({
      id: row.id, createdAt: row.createdAt, requestId: row.requestId,
      attempt: row.attempt, action: row.action, provider: row.provider,
      model: row.model, status: row.status, batchId: row.batchId,
      refId: row.refId, costUsd: row.costUsd === null ? null : Number(row.costUsd),
      costType: row.costType,
      userId: row.userId, projectId: row.projectId, errorCode: row.errorCode, latencyMs: row.latencyMs, units: row.units,
    })),
    detailLimit: DETAIL_LIMIT,
    detailTotal: rows.length,
  };
}

function emptyTotals(): Omit<AiCostGroup, 'key' | 'label'> {
  return { attempts: 0, successes: 0, errors: 0, confirmedUsd: 0, estimatedUsd: 0, unknownAttempts: 0, latencyMs: 0 };
}
function emptyGroup(key: string, label: string): AiCostGroup { return { key, label, ...emptyTotals() }; }
function addGroup(total: Omit<AiCostGroup, 'key' | 'label'>, group: AiCostGroup) {
  total.attempts += group.attempts; total.successes += group.successes; total.errors += group.errors;
  total.confirmedUsd += group.confirmedUsd; total.estimatedUsd += group.estimatedUsd;
  total.unknownAttempts += group.unknownAttempts; total.latencyMs += group.latencyMs;
  return total;
}

export const AI_COST_ACTIONS: ModelAction[] = ['vision', 'chat', 'plano2d', 'render3d', 'inpaint', 'memoria'];
