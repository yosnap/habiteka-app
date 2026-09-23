import { describe, it, expect, beforeEach, vi } from 'vitest';
// El resolutor de claves importa 'server-only'; en Vitest no hay Server Components.
vi.mock('server-only', () => ({}));
import {
  getTypesafeProviderStatus,
  updateTypesafeProvider,
  TYPESAFE_PROVIDER,
} from '@/server/admin/config/ai-provider-ops';
import { updateSystemSetting } from '@/server/admin/config/system-setting-ops';
import { ConfigValidationError } from '@/server/admin/config/config-errors';
import { resolveProviderKey } from '@/server/ai/provider-key-resolver';
import { QUALITY_THRESHOLDS_KEY } from '@/server/quality/evaluate';
import { prisma } from '@/server/db/prisma';
import { resetDb } from '../helpers/db';

const ADMIN = 'admin-1';

beforeEach(async () => {
  await resetDb();
  await prisma.aiProviderCredential.deleteMany({ where: { provider: TYPESAFE_PROVIDER } });
  await prisma.systemSetting.deleteMany({ where: { key: QUALITY_THRESHOLDS_KEY } });
});

describe('proveedor typesafe en el admin', () => {
  it('guarda la clave cifrada, la deja recuperable server-side y no la expone en claro', async () => {
    await updateTypesafeProvider(ADMIN, { apiKey: 'sk-jev-de-prueba-1234', enabled: true });

    const status = await getTypesafeProviderStatus();
    expect(status.provider).toBe(TYPESAFE_PROVIDER);
    expect(status.configured).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.keyHint).not.toContain('de-prueba');
    expect(await resolveProviderKey(TYPESAFE_PROVIDER)).toBe('sk-jev-de-prueba-1234');

    const row = await prisma.aiProviderCredential.findUniqueOrThrow({
      where: { provider: TYPESAFE_PROVIDER },
    });
    expect(row.encryptedApiKey).not.toContain('sk-jev-de-prueba-1234');
  });

  it('rechaza una clave incompleta', async () => {
    await expect(updateTypesafeProvider(ADMIN, { apiKey: 'corta', enabled: true })).rejects.toThrow();
  });

  it('deja auditoría del cambio', async () => {
    await updateTypesafeProvider(ADMIN, { apiKey: 'sk-jev-de-prueba-1234', enabled: false });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'update_ai_provider', targetId: TYPESAFE_PROVIDER },
    });
    expect(audit.actorId).toBe(ADMIN);
  });
});

describe('ajuste quality_thresholds', () => {
  it('acepta bandas coherentes', async () => {
    await updateSystemSetting(ADMIN, QUALITY_THRESHOLDS_KEY, { proceed: 90, confirm: 70 });
    const setting = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: QUALITY_THRESHOLDS_KEY },
    });
    expect(setting.value).toEqual({ proceed: 90, confirm: 70 });
  });

  it('rechaza confirm ≥ proceed y valores fuera de 0–100', async () => {
    await expect(
      updateSystemSetting(ADMIN, QUALITY_THRESHOLDS_KEY, { proceed: 60, confirm: 60 }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(
      updateSystemSetting(ADMIN, QUALITY_THRESHOLDS_KEY, { proceed: 120, confirm: 60 }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(
      updateSystemSetting(ADMIN, QUALITY_THRESHOLDS_KEY, { proceed: 85.5, confirm: 60 }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
