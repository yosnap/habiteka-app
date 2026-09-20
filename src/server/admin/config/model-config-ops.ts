/**
 * Operaciones de configuración de modelos (lógica de negocio).
 *
 * Edita el mapeo acción→modelo que la capa de IA lee en runtime. Valida que el
 * modelo elegido está en la allowlist y que los respaldos no superan el límite del
 * proveedor, de modo que una configuración inválida no llega a la base. Tras
 * guardar, invalida la caché de la capa de IA para que el cambio surta efecto sin
 * redeploy, y registra la acción.
 */
import type { Prisma } from '@/generated/prisma/client';
import type { ModelAction } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/prisma';
import { invalidateModelConfig } from '@/server/ai';
import { allowedModel, isModelAllowed } from './model-allowlist';
import { writeAudit } from '../audit';
import { configError } from './config-errors';

const MAX_FALLBACKS = 3;

export interface UpdateModelInput {
  action: ModelAction;
  primaryModel: string;
  enabled: boolean;
  provider: ModelProvider;
  backups: ModelBackup[];
}

export type ModelProvider = 'openrouter' | 'kie' | 'nan' | 'openai';
export interface ModelBackup { model: string; provider: ModelProvider; }

function validateModelConfig(input: UpdateModelInput, saved?: { primaryModel: string; provider: string | null }): void {
  const provider = input.provider;
  if (!isModelAllowed(input.action, input.primaryModel, provider)) {
    throw configError(`Modelo no permitido para ${input.action}: ${input.primaryModel}`);
  }
  if (input.backups.length > MAX_FALLBACKS) {
    throw configError(`Demasiados modelos de respaldo (máximo ${MAX_FALLBACKS})`);
  }
  for (const backup of input.backups) {
    if (!isModelAllowed(input.action, backup.model, backup.provider)) {
      throw configError(`Modelo de respaldo no permitido: ${backup.model}`);
    }
  }
  const model = allowedModel(input.action, input.primaryModel, provider);
  const alreadySaved = saved?.primaryModel === input.primaryModel && (saved.provider ?? 'openrouter') === provider;
  if (model?.status === 'deprecated' && !alreadySaved) {
    throw configError(`El modelo ${input.primaryModel} está deprecado y no puede asignarse de nuevo`);
  }
}

/** Valida un perfil sin persistirlo como mapeo activo. */
export function validateModelInputs(inputs: UpdateModelInput[]): void {
  if (inputs.length === 0) throw configError('El perfil debe incluir al menos un uso de IA');
  const actions = new Set(inputs.map((input) => input.action));
  if (actions.size !== inputs.length) throw configError('El perfil contiene usos de IA repetidos');
  inputs.forEach((input) => validateModelConfig(input));
}

/** Persiste la configuración de una acción tras validarla; invalida la caché. */
export async function updateModelConfig(actorId: string, input: UpdateModelInput): Promise<void> {
  const current = await prisma.modelConfig.findUnique({ where: { action: input.action } });
  validateModelConfig(input, current ?? undefined);

  await persistModelConfig(input);

  // El cambio surte efecto en la siguiente llamada de IA, sin redeploy.
  invalidateModelConfig();

  await writeAudit({
    actorId,
    action: 'update_model_config',
    targetType: 'model_config',
    targetId: input.action,
    meta: auditMeta(input, false),
  });
}

/** Guarda todas las rutas de IA de una vez, sin dejar un perfil a medias. */
export async function replaceModelConfigs(actorId: string, inputs: UpdateModelInput[]): Promise<void> {
  if (inputs.length === 0) throw configError('Debes indicar al menos una configuración de modelo');
  const uniqueActions = new Set(inputs.map((input) => input.action));
  if (uniqueActions.size !== inputs.length) throw configError('Hay usos de IA repetidos en la configuración');
  const existing = await prisma.modelConfig.findMany({ where: { action: { in: inputs.map((input) => input.action) } } });
  const existingByAction = new Map(existing.map((config) => [config.action, config]));
  inputs.forEach((input) => validateModelConfig(input, existingByAction.get(input.action)));

  await prisma.$transaction(inputs.flatMap((input) => modelConfigOperations(input)));
  invalidateModelConfig();
  await Promise.all(inputs.map((input) => writeAudit({
    actorId,
    action: 'update_model_config',
    targetType: 'model_config',
    targetId: input.action,
    meta: auditMeta(input, true),
  })));
}

/** Devuelve la configuración actual de todas las acciones. */
export async function listModelConfig() {
  const [configs, routes] = await Promise.all([
    prisma.modelConfig.findMany({ orderBy: { action: 'asc' } }),
    prisma.aiModelRoute.findMany({ orderBy: [{ action: 'asc' }, { position: 'asc' }] }),
  ]);
  const routesByAction = new Map<ModelAction, ModelBackup[]>();
  for (const route of routes) {
    if (route.position === 0 || !isProvider(route.provider)) continue;
    const backups = routesByAction.get(route.action) ?? [];
    backups.push({ model: route.model, provider: route.provider });
    routesByAction.set(route.action, backups);
  }
  return configs.map((config) => ({ ...config, backups: routesByAction.get(config.action) ?? legacyBackups(config) }));
}

async function persistModelConfig(input: UpdateModelInput): Promise<void> {
  await prisma.$transaction(modelConfigOperations(input));
}

function modelConfigOperations(input: UpdateModelInput) {
  return [
    prisma.modelConfig.upsert({
      where: { action: input.action },
      create: { action: input.action, primaryModel: input.primaryModel, fallbacks: input.backups.map((backup) => backup.model), provider: input.provider === 'openrouter' ? null : input.provider, enabled: input.enabled },
      update: { primaryModel: input.primaryModel, fallbacks: input.backups.map((backup) => backup.model), provider: input.provider === 'openrouter' ? null : input.provider, enabled: input.enabled },
    }),
    prisma.aiModelRoute.deleteMany({ where: { action: input.action } }),
    prisma.aiModelRoute.createMany({
      data: [{ action: input.action, model: input.primaryModel, provider: input.provider, position: 0, enabled: input.enabled }, ...input.backups.map((backup, index) => ({ action: input.action, model: backup.model, provider: backup.provider, position: index + 1, enabled: input.enabled }))],
    }),
  ];
}

function legacyBackups(config: { fallbacks: string[]; provider: string | null }): ModelBackup[] {
  const provider = isProvider(config.provider) ? config.provider : 'openrouter';
  return config.fallbacks.map((model) => ({ model, provider }));
}

function isProvider(provider: string | null): provider is ModelProvider {
  return provider === 'openrouter' || provider === 'kie' || provider === 'nan' || provider === 'openai';
}

function auditMeta(input: UpdateModelInput, batch: boolean): Prisma.InputJsonValue {
  return { primaryModel: input.primaryModel, backups: input.backups.map((backup) => ({ ...backup })), provider: input.provider, enabled: input.enabled, ...(batch ? { batch: true } : {}) } as Prisma.InputJsonValue;
}
