import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';
import { configError } from './config-errors';
import { type UpdateModelInput, validateModelInputs } from './model-config-ops';
import { writeAudit } from '../audit';

export async function listCustomModelProfiles() {
  const rows = await prisma.aiModelProfile.findMany({ orderBy: { name: 'asc' } });
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description ?? 'Perfil personalizado.', configurations: parseConfigurations(row.configurations) }));
}

export async function saveCustomModelProfile(actorId: string, input: { name: string; description?: string; configurations: UpdateModelInput[] }) {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 60) throw configError('El nombre del perfil debe tener entre 3 y 60 caracteres');
  await validateModelInputs(input.configurations);
  const profile = await prisma.aiModelProfile.upsert({
    where: { name }, create: { name, description: input.description?.trim() || null, configurations: input.configurations as unknown as Prisma.InputJsonValue },
    update: { description: input.description?.trim() || null, configurations: input.configurations as unknown as Prisma.InputJsonValue },
  });
  await writeAudit({ actorId, action: 'save_ai_model_profile', targetType: 'ai_model_profile', targetId: profile.id, meta: { name } });
  return profile.id;
}

function parseConfigurations(value: unknown): UpdateModelInput[] {
  if (!Array.isArray(value)) return [];
  const configurations = value.filter(isConfiguration);
  return configurations.length === value.length ? configurations : [];
}

function isConfiguration(value: unknown): value is UpdateModelInput {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<UpdateModelInput>;
  return typeof item.action === 'string' && typeof item.primaryModel === 'string' && typeof item.enabled === 'boolean' && typeof item.provider === 'string' && item.provider.length > 0 && Array.isArray(item.backups);
}
