import { prisma } from '@/server/db/prisma';
import { sealSecret, secretHint } from '@/server/security/secret-box';
import { writeAudit } from '../audit';
import { configError } from './config-errors';

// Jev (TypeSafe): evalúa la calidad de cada generación, no genera contenido. Es la única clave de IA de la plataforma.
export const TYPESAFE_PROVIDER = 'typesafe';
export interface ProviderStatus { provider: string; configured: boolean; enabled: boolean; keyHint: string | null; updatedAt: Date | null; }

export async function getTypesafeProviderStatus(): Promise<ProviderStatus> {
  const credential = await prisma.aiProviderCredential.findUnique({ where: { provider: TYPESAFE_PROVIDER } });
  return { provider: TYPESAFE_PROVIDER, configured: !!credential, enabled: credential?.enabled ?? false, keyHint: credential?.keyHint ?? null, updatedAt: credential?.updatedAt ?? null };
}

/** Cifra la clave de Jev al guardarla; en la base solo queda el texto cifrado y una pista de 4 caracteres. */
export async function updateTypesafeProvider(actorId: string, input: { apiKey: string; enabled: boolean }): Promise<void> {
  const apiKey = input.apiKey.trim();
  const saved = await prisma.aiProviderCredential.findUnique({ where: { provider: TYPESAFE_PROVIDER } });
  // Sin clave nueva solo se activa o desactiva la guardada.
  if (!apiKey) {
    if (!saved) throw configError('Pega la API key de TypeSafe');
    await prisma.aiProviderCredential.update({ where: { provider: TYPESAFE_PROVIDER }, data: { enabled: input.enabled } });
  } else {
    if (apiKey.length < 12) throw configError('La API key de TypeSafe parece incompleta');
    const sealed = { encryptedApiKey: sealSecret(apiKey), keyHint: secretHint(apiKey), enabled: input.enabled };
    await prisma.aiProviderCredential.upsert({ where: { provider: TYPESAFE_PROVIDER }, create: { provider: TYPESAFE_PROVIDER, ...sealed }, update: sealed });
  }
  await writeAudit({ actorId, action: 'update_ai_provider', targetType: 'ai_provider', targetId: TYPESAFE_PROVIDER, meta: { enabled: input.enabled, keyChanged: !!apiKey } });
}
