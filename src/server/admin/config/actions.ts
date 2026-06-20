'use server';

/**
 * Server Actions de configuración del back-office. Cada una revalida el rol admin
 * antes de actuar y delega en las operaciones, que validan y auditan.
 */
import { requireAdmin } from '../guard';
import { updateModelConfig, listModelConfig, type UpdateModelInput } from './model-config-ops';
import { updateSystemSetting, listSystemSettings } from './system-setting-ops';
import { updateBranding, type BrandingInput } from '../branding/branding-ops';
import { createPolarProduct, type CreateProductInput } from '../billing/product-ops';

export async function adminListModelConfig() {
  await requireAdmin();
  return listModelConfig();
}

export async function adminUpdateModelConfig(input: UpdateModelInput) {
  const actor = await requireAdmin();
  await updateModelConfig(actor.userId, input);
}

export async function adminListSystemSettings() {
  await requireAdmin();
  return listSystemSettings();
}

export async function adminUpdateSystemSetting(key: string, value: unknown) {
  const actor = await requireAdmin();
  await updateSystemSetting(actor.userId, key, value);
}

export async function adminUpdateBranding(input: BrandingInput) {
  const actor = await requireAdmin();
  await updateBranding(actor.userId, input);
}

export async function adminCreatePolarProduct(input: CreateProductInput) {
  const actor = await requireAdmin();
  return createPolarProduct(actor.userId, input);
}
