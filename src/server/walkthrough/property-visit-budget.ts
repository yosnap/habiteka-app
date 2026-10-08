import 'server-only';
import type { PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import { propertyVisitVideoBudget, propertyVisitDurationIssue, videoGenerationBudget } from '@/lib/editor-document/property-visit-budget';

/** Solo datos públicos del BCE; no envía información del proyecto. Si no hay cambio reciente, no autoriza gasto. */
export async function inspectPropertyVisitBudget(job: PropertyVisitJob) {
  const durationIssue = propertyVisitDurationIssue(job);
  if (durationIssue) return { maxEur: 2, issue: durationIssue, rateDate: null };
  return inspectVideoBudget(rate => propertyVisitVideoBudget(job, rate));
}

async function inspectVideoBudget(calculate: (rate: number) => ReturnType<typeof videoGenerationBudget>) {
  try {
    const response = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Cambio no disponible');
    const xml = await response.text();
    const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
    const rate = /currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/.exec(xml)?.[1];
    const age = Date.now() - Date.parse(`${date}T00:00:00Z`);
    if (!date || !rate || !Number.isFinite(age) || age < -86400000 || age > 7 * 86400000) throw new Error('Cambio caducado');
    return { ...calculate(Number(rate)), rateDate: date };
  } catch {
    return { maxEur: 2, issue: 'Generación bloqueada: falta verificar el cambio EUR/USD para respetar el máximo de 2 € por vídeo completo.', rateDate: null };
  }
}

export async function assertStandaloneVideoBudget(usd: number, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60000)
    throw new Error('Cada vídeo independiente debe durar como máximo 60 segundos.');
  const budget = await inspectVideoBudget(rate => videoGenerationBudget(usd, rate));
  if (budget.issue) throw new Error(budget.issue);
}

export async function assertPropertyVisitBudget(job: PropertyVisitJob) {
  const budget = await inspectPropertyVisitBudget(job);
  if (budget.issue) throw new Error(budget.issue);
}
