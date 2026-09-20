import { prisma } from '@/server/db/prisma';
import { sealSecret, secretHint } from '@/server/security/secret-box';
import { writeAudit } from '../audit';
import { configError } from './config-errors';

export const KIE_PROVIDER = 'kie';
export const NAN_PROVIDER = 'nan';
export const OPENROUTER_PROVIDER = 'openrouter';
export const OPENAI_PROVIDER = 'openai';
export interface ProviderStatus { provider: string; configured: boolean; enabled: boolean; keyHint: string | null; updatedAt: Date | null; }

export async function getKieProviderStatus(): Promise<ProviderStatus> {
  return getProviderStatus(KIE_PROVIDER);
}

export async function getOpenRouterProviderStatus(): Promise<ProviderStatus> {
  return getProviderStatus(OPENROUTER_PROVIDER);
}

export async function getOpenAiProviderStatus(): Promise<ProviderStatus> {
  return getProviderStatus(OPENAI_PROVIDER);
}

export async function updateKieProvider(actorId: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  return updateProvider(actorId, KIE_PROVIDER, input);
}

export async function updateOpenRouterProvider(actorId: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  return updateProvider(actorId, OPENROUTER_PROVIDER, input);
}

export async function updateOpenAiProvider(actorId: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  return updateProvider(actorId, OPENAI_PROVIDER, input);
}

export async function getNanProviderStatus(): Promise<ProviderStatus & { provider: typeof NAN_PROVIDER }> {
  const status = await getProviderStatus(NAN_PROVIDER);
  return { ...status, provider: NAN_PROVIDER };
}

export async function updateNanProvider(actorId: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  return updateProvider(actorId, NAN_PROVIDER, input);
}

async function getProviderStatus(provider: string): Promise<ProviderStatus> {
  const credential = await prisma.aiProviderCredential.findUnique({ where: { provider } });
  return { provider, configured: !!credential, enabled: credential?.enabled ?? false, keyHint: credential?.keyHint ?? null, updatedAt: credential?.updatedAt ?? null };
}

async function updateProvider(actorId: string, provider: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 12) throw configError(`La API key de ${provider.toUpperCase()} parece incompleta`);
  await prisma.aiProviderCredential.upsert({
    where: { provider },
    create: { provider, encryptedApiKey: sealSecret(apiKey), keyHint: secretHint(apiKey), enabled: input.enabled },
    update: { encryptedApiKey: sealSecret(apiKey), keyHint: secretHint(apiKey), enabled: input.enabled },
  });
  await writeAudit({ actorId, action: 'update_ai_provider', targetType: 'ai_provider', targetId: provider, meta: { enabled: input.enabled } });
}
