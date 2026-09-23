'use server';

/**
 * Server Actions de configuración del back-office. Cada una revalida el rol admin
 * antes de actuar y delega en las operaciones, que validan y auditan.
 */
import { requireAdmin } from '../guard';
import { revalidatePath } from 'next/cache';
import { updateModelConfig, replaceModelConfigs, listModelConfig, type UpdateModelInput } from './model-config-ops';
import { updateSystemSetting, listSystemSettings } from './system-setting-ops';
import { updateBranding, type BrandingInput } from '../branding/branding-ops';
import { createPolarProduct, type CreateProductInput } from '../billing/product-ops';
import { getKieProviderStatus, getNanProviderStatus, getOpenAiProviderStatus, getOpenRouterProviderStatus, updateKieProvider, updateNanProvider, updateOpenAiProvider, updateOpenRouterProvider, getTypesafeProviderStatus, updateTypesafeProvider } from './ai-provider-ops';
import { listCustomModelProfiles, saveCustomModelProfile } from './model-profile-ops';

export async function adminListModelConfig() {
  await requireAdmin();
  return listModelConfig();
}

export async function adminListCustomModelProfiles() {
  await requireAdmin();
  return listCustomModelProfiles();
}

export async function adminSaveCustomModelProfile(input: { name: string; description?: string; configurations: UpdateModelInput[] }) {
  const actor = await requireAdmin();
  await saveCustomModelProfile(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminUpdateModelConfig(input: UpdateModelInput) {
  const actor = await requireAdmin();
  await updateModelConfig(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminReplaceModelConfigs(inputs: UpdateModelInput[]) {
  const actor = await requireAdmin();
  await replaceModelConfigs(actor.userId, inputs);
  revalidateAiConfigPages();
}

export async function adminGetKieProviderStatus() { await requireAdmin(); return getKieProviderStatus(); }

export async function adminUpdateKieProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateKieProvider(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminGetOpenRouterProviderStatus() { await requireAdmin(); return getOpenRouterProviderStatus(); }

export async function adminUpdateOpenRouterProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateOpenRouterProvider(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminGetOpenAiProviderStatus() { await requireAdmin(); return getOpenAiProviderStatus(); }

export async function adminUpdateOpenAiProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateOpenAiProvider(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminGetNanProviderStatus() { await requireAdmin(); return getNanProviderStatus(); }

export async function adminUpdateNanProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateNanProvider(actor.userId, input);
  revalidateAiConfigPages();
}

export async function adminGetTypesafeProviderStatus() { await requireAdmin(); return getTypesafeProviderStatus(); }

export async function adminUpdateTypesafeProvider(input: { apiKey: string; enabled: boolean }) {
  const actor = await requireAdmin();
  await updateTypesafeProvider(actor.userId, input);
  revalidateAiConfigPages();
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

export async function adminUpdateBranding(input: BrandingInput) {
  const actor = await requireAdmin();
  await updateBranding(actor.userId, input);
}

export async function adminCreatePolarProduct(input: CreateProductInput) {
  const actor = await requireAdmin();
  return createPolarProduct(actor.userId, input);
}

function revalidateAiConfigPages(): void {
  revalidatePath('/config');
  revalidatePath('/config/models');
}
