import 'server-only';
import { prisma } from '@/server/db/prisma';
import { openSecret } from '@/server/security/secret-box';
import { aiError } from './errors';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { providerLabel } from './custom-ai-providers';
import { AI_KEYS_SETTINGS_PATH } from '@/lib/ai-keys-settings';

/** Quién paga la llamada: la organización del contexto y el usuario que la pide. */
export interface ProviderKeyScope { organizationId: string; userId: string }


/**
 * Resuelve la clave de un proveedor para una llamada server-side. Cada organización usa su propia clave: primero se
 * comprueba que el usuario pertenece a la organización del contexto (sin eso, cualquiera podría gastar la clave de
 * otra pasando su id) y después se lee su credencial. Solo la cuenta admin de la plataforma, sin clave propia, cae en
 * la clave global del panel; al resto se le bloquea la generación con un mensaje que dice dónde añadirla.
 */
export async function resolveProviderKey(scope: ProviderKeyScope, provider: string): Promise<string> {
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId: scope.organizationId, userId: scope.userId } },
    select: { user: { select: { role: true } } },
  });
  // No es un fallo del proveedor: no pasa al respaldo ni prueba otra clave.
  if (!member) throw new UserFacingError('No perteneces a la organización de esta generación.');
  const own = await prisma.organizationAiCredential.findUnique({
    where: { organizationId_provider: { organizationId: scope.organizationId, provider } },
  });
  if (own) return open(own.encryptedApiKey, provider);
  if (member.user.role === 'admin') return resolvePlatformProviderKey(provider);
  throw aiError('missing_key', `Tu organización no tiene clave de ${providerLabel(provider)}. Añádela en Ajustes › Claves de IA (${AI_KEYS_SETTINGS_PATH}).`);
}

export async function resolveKieKey(scope: ProviderKeyScope): Promise<string> {
  return resolveProviderKey(scope, 'kie');
}

/** Clave global del panel de admin: solo para el propio panel, Jev y la cuenta admin. */
export async function resolvePlatformProviderKey(provider: string): Promise<string> {
  const credential = await prisma.aiProviderCredential.findUnique({ where: { provider } });
  if (!credential?.enabled) throw aiError('provider_down', `${providerLabel(provider)} no está configurado o está desactivado`);
  return open(credential.encryptedApiKey, provider);
}

function open(sealed: string, provider: string): string {
  try { return openSecret(sealed); }
  catch (error) { throw aiError('provider_down', `No se pudo descifrar la credencial de ${providerLabel(provider)}`, error); }
}
