'use server';

/**
 * Server Actions de «Mi perfil» (organización y modelos). La organización sale siempre de la sesión, nunca del
 * cliente. El nombre y la contraseña del usuario los cambia Better Auth desde el cliente con su propia validación.
 */
import { revalidatePath } from 'next/cache';
import type { ModelAction } from '@/generated/prisma/enums';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction } from '@/server/errors/run-action';
import { renameOrganization } from './profile-ops';
import { resetOrganizationModelUse, saveOrganizationModelUse, type ModelRef } from './organization-model-ops';

export async function renameOrganizationAction(name: string) {
  return runAction(async () => {
    await renameOrganization(await requireOrgContext(), name);
    revalidatePath('/perfil', 'layout');
  });
}

export async function saveModelUseAction(action: ModelAction, chain: ModelRef[]) {
  return runAction(async () => {
    await saveOrganizationModelUse(await requireOrgContext(), action, chain);
    revalidatePath('/perfil', 'layout');
  });
}

export async function resetModelUseAction(action: ModelAction) {
  return runAction(async () => {
    await resetOrganizationModelUse(await requireOrgContext(), action);
    revalidatePath('/perfil', 'layout');
  });
}
