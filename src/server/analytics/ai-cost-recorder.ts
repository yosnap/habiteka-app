import type { ModelAction, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';

export interface AiCostScope {
  organizationId: string;
  userId?: string;
  projectId?: string;
  refId?: string;
  batchId?: string;
}

export interface AiAttemptCost extends AiCostScope {
  requestId: string;
  attempt: number;
  action: ModelAction;
  operation: 'chat' | 'vision' | 'generate' | 'inpaint';
  provider: string;
  model: string;
  status: 'success' | 'error';
  latencyMs: number;
  units?: Prisma.InputJsonValue;
  costUsd?: number;
  costType: 'confirmed' | 'estimated' | 'unknown';
  errorCode?: string;
}

/** Telemetría best-effort: un fallo de observabilidad nunca repite una paid call. */
export async function recordAiAttempt(input: AiAttemptCost): Promise<void> {
  try {
    await prisma.aiRequestCost.create({
      data: {
        ...input,
        userId: input.userId ?? null,
        projectId: input.projectId ?? null,
        refId: input.refId ?? null,
        batchId: input.batchId ?? null,
        units: input.units ?? undefined,
        costUsd: input.costUsd,
        errorCode: input.errorCode ?? null,
      },
    });
  } catch (error) {
    // P2002 significa replay de la misma request+attempt: ya está contabilizado.
    if ((error as { code?: string }).code !== 'P2002') console.error('No se pudo registrar el coste IA', error);
  }
}

export function aiErrorCode(error: unknown): string {
  const value = error as { kind?: string; code?: string; status?: number };
  return value.code ?? value.kind ?? (value.status ? `http_${value.status}` : 'unknown');
}
