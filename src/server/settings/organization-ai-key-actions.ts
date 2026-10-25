'use server';

/**
 * Server Actions de «Mi perfil › Claves de IA». Cada una resuelve la organización desde la sesión (nunca la recibe del
 * cliente), así un usuario solo ve y cambia las claves de su propia organización.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction } from '@/server/errors/run-action';
import type { ModelAction } from '@/generated/prisma/enums';
import { deleteOrganizationAiKey, saveOrganizationAiKey, testOrganizationAiKey } from './organization-ai-keys';
import { deleteCompatibleProvider, deleteEnabledModel, listProviderCatalog, saveCompatibleProvider, saveEnabledModel } from './organization-catalog-ops';

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

export async function saveCompatibleProviderAction(input: { id?: string; label: string; baseUrl: string; apiKey: string }) {
  return runAction(async () => {
    const id = await saveCompatibleProvider(await requireOrgContext(), input);
    revalidatePath('/perfil', 'layout');
    return id;
  });
}

export async function deleteCompatibleProviderAction(id: string) {
  return runAction(async () => {
    await deleteCompatibleProvider(await requireOrgContext(), id);
    revalidatePath('/perfil', 'layout');
  });
}

export async function listProviderCatalogAction(provider: string) {
  return runAction(async () => listProviderCatalog(await requireOrgContext(), provider));
}

export async function saveEnabledModelAction(input: { providerId: string; model: string; label: string; actions: ModelAction[]; priceUsdPerUnit: number }) {
  return runAction(async () => {
    await saveEnabledModel(await requireOrgContext(), input);
    revalidatePath('/perfil', 'layout');
  });
}

export async function deleteEnabledModelAction(providerId: string, model: string) {
  return runAction(async () => {
    await deleteEnabledModel(await requireOrgContext(), providerId, model);
    revalidatePath('/perfil', 'layout');
  });
}
