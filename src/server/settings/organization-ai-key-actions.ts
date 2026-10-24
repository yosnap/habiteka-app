'use server';

/**
 * Server Actions de «Mi perfil › Claves de IA». Cada una resuelve la organización desde la sesión (nunca la recibe del
 * cliente), así un usuario solo ve y cambia las claves de su propia organización.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction } from '@/server/errors/run-action';
import { deleteOrganizationAiKey, saveOrganizationAiKey, testOrganizationAiKey } from './organization-ai-keys';

export async function saveAiKeyAction(provider: string, apiKey: string) {
  return runAction(async () => {
    await saveOrganizationAiKey(await requireOrgContext(), provider, apiKey);
    revalidatePath('/perfil', 'layout');
  });
}

export async function testAiKeyAction(provider: string) {
  return runAction(async () => testOrganizationAiKey(await requireOrgContext(), provider));
}

export async function deleteAiKeyAction(provider: string) {
  return runAction(async () => {
    await deleteOrganizationAiKey(await requireOrgContext(), provider);
    revalidatePath('/perfil', 'layout');
  });
}
