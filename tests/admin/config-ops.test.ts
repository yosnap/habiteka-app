import { describe, it, expect, beforeEach } from 'vitest';
import { updateModelConfig, listModelConfig } from '@/server/admin/config/model-config-ops';
import { updateSystemSetting, listSystemSettings } from '@/server/admin/config/system-setting-ops';
import { updateBranding } from '@/server/admin/branding/branding-ops';
import { getBranding, invalidateBranding } from '@/server/admin/branding/branding-loader';
import { getModelConfig } from '@/server/ai/model-config-loader';
import { ConfigValidationError } from '@/server/admin/config/config-errors';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeUser } from '../helpers/db';

const ADMIN = 'admin-1';

async function clearConfig() {
  await prisma.modelConfig.deleteMany();
  await prisma.brandSettings.deleteMany();
}

describe('model-config-ops', () => {
  beforeEach(async () => {
    await resetDb();
    await clearConfig();
    await makeUser();
  });

  it('persiste la configuración y el loader de IA devuelve el nuevo modelo (caché invalidada)', async () => {
    await updateModelConfig(ADMIN, {
      action: 'chat',
      primaryModel: 'openai/gpt-4o',
      fallbacks: [],
      enabled: true,
    });
    // El loader de F3 debe ver el valor nuevo: la action invalidó su caché.
    const route = await getModelConfig('chat');
    expect(route.primaryModel).toBe('openai/gpt-4o');
  });

  it('rechaza un modelo fuera de la allowlist', async () => {
    await expect(
      updateModelConfig(ADMIN, {
        action: 'chat',
        primaryModel: 'modelo/carisimo-arbitrario',
        fallbacks: [],
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('rechaza más de 3 respaldos', async () => {
    await expect(
      updateModelConfig(ADMIN, {
        action: 'chat',
        primaryModel: 'openai/gpt-4o',
        fallbacks: ['a', 'b', 'c', 'd'],
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('audita el cambio de configuración', async () => {
    await updateModelConfig(ADMIN, {
      action: 'vision',
      primaryModel: 'google/gemini-2.5-flash',
      fallbacks: [],
      enabled: true,
    });
    const audit = await prisma.auditLog.findFirst({ where: { action: 'update_model_config' } });
    expect(audit?.actorId).toBe(ADMIN);
    expect(await listModelConfig()).toHaveLength(1);
  });
});

describe('system-setting-ops', () => {
  beforeEach(async () => {
    await resetDb();
    await makeUser();
  });

  it('persiste un ajuste entero válido', async () => {
    await updateSystemSetting(ADMIN, 'welcome_credits', 250);
    const settings = await listSystemSettings();
    const ws = settings.find((s) => s.key === 'welcome_credits');
    expect(ws?.value).toBe(250);
  });

  it('rechaza un valor negativo o no entero en un ajuste numérico', async () => {
    await expect(updateSystemSetting(ADMIN, 'welcome_credits', -5)).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
    await expect(
      updateSystemSetting(ADMIN, 'free_iterations_per_deliverable', 1.5),
    ).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('rechaza un valor por encima del techo de cordura', async () => {
    await expect(updateSystemSetting(ADMIN, 'welcome_credits', 9_999_999)).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });
});

describe('branding-ops', () => {
  beforeEach(async () => {
    await resetDb();
    await clearConfig();
    await makeUser();
    invalidateBranding();
  });

  it('guarda la marca y el loader la devuelve tras invalidar', async () => {
    await updateBranding(ADMIN, { brandName: 'Habiteka Pro', colors: { primary: '#aa3311' } });
    const branding = await getBranding();
    expect(branding.brandName).toBe('Habiteka Pro');
    expect(branding.colors.primary).toBe('#aa3311');
  });

  it('rechaza un color con hex inválido', async () => {
    await expect(
      updateBranding(ADMIN, { brandName: 'X', colors: { primary: 'rojo' } }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
