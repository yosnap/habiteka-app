'use server';

/**
 * Server Actions de configuración de la plataforma. Cada una revalida el rol admin antes de actuar y delega en las
 * operaciones, que validan y auditan. Los proveedores, las claves y los modelos de IA no están aquí: los gestiona cada
 * organización en Mi perfil. Solo queda la clave de Jev, que paga la plataforma.
 */
import { requireAdmin } from '../guard';
import { revalidatePath } from 'next/cache';
import { updateSystemSetting, listSystemSettings } from './system-setting-ops';
import { getTypesafeProviderStatus, updateTypesafeProvider } from './ai-provider-ops';

export async function adminGetTypesafeProviderStatus() { await requireAdmin(); return getTypesafeProviderStatus(); }

export async function adminUpdateTypesafeProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateTypesafeProvider(actor.userId, input);
  revalidatePath('/config/system');
}

export async function adminListSystemSettings() {
  await requireAdmin();
  return listSystemSettings();
}

export async function adminUpdateSystemSetting(key: string, value: unknown) {
  const actor = await requireAdmin();
  await updateSystemSetting(actor.userId, key, value);
  revalidatePath('/config/system');
}
