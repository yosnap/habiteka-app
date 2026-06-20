/**
 * Operaciones de configuración de modelos (lógica de negocio).
 *
 * Edita el mapeo acción→modelo que la capa de IA lee en runtime. Valida que el
 * modelo elegido está en la allowlist y que los respaldos no superan el límite del
 * proveedor, de modo que una configuración inválida no llega a la base. Tras
 * guardar, invalida la caché de la capa de IA para que el cambio surta efecto sin
 * redeploy, y registra la acción.
 */
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { invalidateModelConfig } from '@/server/ai';
import { isModelAllowed } from './model-allowlist';
import { writeAudit } from '../audit';
import { configError } from './config-errors';

const MAX_FALLBACKS = 3;

export interface UpdateModelInput {
  action: ModelAction;
  primaryModel: string;
  fallbacks: string[];
  enabled: boolean;
}

/** Persiste la configuración de una acción tras validarla; invalida la caché. */
export async function updateModelConfig(actorId: string, input: UpdateModelInput): Promise<void> {
  if (!isModelAllowed(input.action, input.primaryModel)) {
    throw configError(`Modelo no permitido para ${input.action}: ${input.primaryModel}`);
  }
  if (input.fallbacks.length > MAX_FALLBACKS) {
    throw configError(`Demasiados modelos de respaldo (máximo ${MAX_FALLBACKS})`);
  }
  for (const fb of input.fallbacks) {
    if (!isModelAllowed(input.action, fb)) {
      throw configError(`Modelo de respaldo no permitido: ${fb}`);
    }
  }

  await prisma.modelConfig.upsert({
    where: { action: input.action },
    create: {
      action: input.action,
      primaryModel: input.primaryModel,
      fallbacks: input.fallbacks,
      enabled: input.enabled,
    },
    update: {
      primaryModel: input.primaryModel,
      fallbacks: input.fallbacks,
      enabled: input.enabled,
    },
  });

  // El cambio surte efecto en la siguiente llamada de IA, sin redeploy.
  invalidateModelConfig();

  await writeAudit({
    actorId,
    action: 'update_model_config',
    targetType: 'model_config',
    targetId: input.action,
    meta: { primaryModel: input.primaryModel, fallbacks: input.fallbacks, enabled: input.enabled },
  });
}

/** Devuelve la configuración actual de todas las acciones. */
export async function listModelConfig() {
  return prisma.modelConfig.findMany({ orderBy: { action: 'asc' } });
}
