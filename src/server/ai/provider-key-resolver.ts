import 'server-only';
import { prisma } from '@/server/db/prisma';
import { openSecret } from '@/server/security/secret-box';
import { aiError } from './errors';

/** Resuelve una clave de proveedor exclusivamente para llamadas server-side. */
export async function resolveKieKey(): Promise<string> {
  return resolveProviderKey('kie');
}

export async function resolveProviderKey(provider: string): Promise<string> {
  const credential = await prisma.aiProviderCredential.findUnique({ where: { provider } });
  if (!credential?.enabled) throw aiError('provider_down', `${provider.toUpperCase()} no está configurado o está desactivado`);
  try { return openSecret(credential.encryptedApiKey); }
  catch (error) { throw aiError('provider_down', `No se pudo descifrar la credencial de ${provider.toUpperCase()}`, error); }
}
