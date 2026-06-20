/**
 * Protección del saldo del proveedor antes de cada llamada de IA.
 *
 * Pagamos al proveedor ANTES de debitar al usuario, así que un abuso (bucles,
 * prompts masivos) puede vaciar el saldo. Este guardia, previo a tocar al
 * proveedor, aplica tres frenos por organización: límite de frecuencia, tope de
 * gasto diario y un cortacircuitos que abre tras fallos repetidos. El cap GLOBAL
 * agregado (anti-sybil multi-cuenta) vive en la fase de facturación.
 *
 * Estado en memoria por proceso (suficiente para el MVP); las ventanas se
 * reinician por tiempo. La unidad de gasto es neutral (USD estimado de la llamada).
 */
import { aiError } from '../errors';

interface OrgWindow {
  windowStart: number;
  requestCount: number;
  spentUsd: number;
  // Cortacircuitos: cuenta fallos consecutivos y, si se abre, hasta cuándo.
  consecutiveFailures: number;
  openUntil: number;
}

export interface SpendLimits {
  maxRequestsPerWindow: number;
  windowMs: number;
  dailyCapUsd: number;
  breakerThreshold: number;
  breakerCooldownMs: number;
}

export const DEFAULT_LIMITS: SpendLimits = {
  maxRequestsPerWindow: 60,
  windowMs: 60_000,
  dailyCapUsd: 25,
  breakerThreshold: 5,
  breakerCooldownMs: 30_000,
};

const windows = new Map<string, OrgWindow>();

function getWindow(orgId: string, now: number, limits: SpendLimits): OrgWindow {
  const existing = windows.get(orgId);
  if (!existing || now - existing.windowStart >= limits.windowMs) {
    const fresh: OrgWindow = {
      windowStart: now,
      requestCount: 0,
      // El gasto diario no se reinicia con la ventana de frecuencia: se conserva
      // si seguimos dentro del mismo día.
      spentUsd: existing && now - existing.windowStart < 86_400_000 ? existing.spentUsd : 0,
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
      openUntil: existing?.openUntil ?? 0,
    };
    windows.set(orgId, fresh);
    return fresh;
  }
  return existing;
}

/**
 * Verifica que la organización puede hacer una llamada cuyo coste estimado es
 * `estimateUsd`. Lanza `AiError` (rate_limit | spend_cap | provider_down) SIN
 * tocar al proveedor cuando algún freno aplica.
 */
export function assertCanSpend(
  orgId: string,
  estimateUsd: number,
  now: number = Date.now(),
  limits: SpendLimits = DEFAULT_LIMITS,
): void {
  const w = getWindow(orgId, now, limits);

  if (w.openUntil > now) {
    throw aiError('provider_down', 'Cortacircuitos abierto tras fallos repetidos');
  }
  if (w.requestCount >= limits.maxRequestsPerWindow) {
    throw aiError('rate_limit', 'Límite de frecuencia de IA superado');
  }
  if (w.spentUsd + estimateUsd > limits.dailyCapUsd) {
    throw aiError('spend_cap', 'Cap diario de gasto de IA superado');
  }

  w.requestCount += 1;
  w.spentUsd += estimateUsd;
}

/** Registra el resultado de una llamada para el cortacircuitos. */
export function recordOutcome(
  orgId: string,
  ok: boolean,
  now: number = Date.now(),
  limits: SpendLimits = DEFAULT_LIMITS,
): void {
  const w = windows.get(orgId);
  if (!w) return;
  if (ok) {
    w.consecutiveFailures = 0;
    return;
  }
  w.consecutiveFailures += 1;
  if (w.consecutiveFailures >= limits.breakerThreshold) {
    w.openUntil = now + limits.breakerCooldownMs;
    w.consecutiveFailures = 0;
  }
}

/** Reinicia el estado (tests). */
export function resetSpendGuard(): void {
  windows.clear();
}
