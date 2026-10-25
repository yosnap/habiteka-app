import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ member: vi.fn(), own: vi.fn(), platform: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  member: { findUnique: db.member },
  organizationAiCredential: { findUnique: db.own },
  aiProviderCredential: { findUnique: db.platform },
} }));
vi.mock('@/server/security/secret-box', () => ({ openSecret: (value: string) => `abierta:${value}` }));
import { resolveKieKey, resolvePlatformProviderKey, resolveProviderKey } from '@/server/ai/provider-key-resolver';
import { AiError } from '@/server/ai/errors';

const scope = { organizationId: 'org-a', userId: 'user-a' };
beforeEach(() => {
  vi.resetAllMocks();
  db.member.mockResolvedValue({ id: 'm' });
  db.platform.mockResolvedValue({ provider: 'openrouter', encryptedApiKey: 'global', enabled: true });
});

describe('resolución de claves por organización', () => {
  it('usa la clave de la organización del contexto, buscada por organización y proveedor', async () => {
    db.own.mockResolvedValue({ encryptedApiKey: 'propia' });
    await expect(resolveProviderKey(scope, 'openrouter')).resolves.toBe('abierta:propia');
    expect(db.member).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_userId: { organizationId: 'org-a', userId: 'user-a' } } }));
    expect(db.own).toHaveBeenCalledWith({ where: { organizationId_provider: { organizationId: 'org-a', provider: 'openrouter' } } });
    expect(db.platform).not.toHaveBeenCalled();
  });

  it('rechaza a quien no pertenece a la organización sin leer ninguna clave (sin IDOR)', async () => {
    db.member.mockResolvedValue(null);
    db.own.mockResolvedValue({ encryptedApiKey: 'ajena' });
    const error = await resolveProviderKey({ organizationId: 'org-b', userId: 'user-a' }, 'kie').catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AiError);
    expect(error.message).toMatch(/No perteneces/);
    expect(db.own).not.toHaveBeenCalled();
    expect(db.platform).not.toHaveBeenCalled();
  });

  it('bloquea a una organización sin clave y no cae en la clave global', async () => {
    db.own.mockResolvedValue(null);
    const error = await resolveKieKey(scope).catch((caught) => caught);
    expect(error).toBeInstanceOf(AiError);
    expect(error.kind).toBe('missing_key');
    expect(error.message).toMatch(/Tu organización no tiene clave de KIE.*Mi perfil › Claves de IA/);
    expect(db.platform).not.toHaveBeenCalled();
  });

  it('la cuenta admin tampoco cae en claves globales: usa las de su organización', async () => {
    db.member.mockResolvedValue({ id: 'm' });
    db.own.mockResolvedValue(null);
    await expect(resolveProviderKey(scope, 'openrouter')).rejects.toMatchObject({ kind: 'missing_key' });
    expect(db.platform).not.toHaveBeenCalled();
    db.own.mockResolvedValue({ encryptedApiKey: 'propia' });
    await expect(resolveProviderKey(scope, 'openrouter')).resolves.toBe('abierta:propia');
  });

  it('la clave de la plataforma (Jev) desactivada no se usa', async () => {
    db.platform.mockResolvedValue({ provider: 'kie', encryptedApiKey: 'global', enabled: false });
    await expect(resolvePlatformProviderKey('kie')).rejects.toMatchObject({ kind: 'provider_down' });
  });
});
