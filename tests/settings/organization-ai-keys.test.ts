import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ custom: vi.fn(), list: vi.fn(), upsert: vi.fn(), remove: vi.fn(), one: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  aiCustomProvider: { findMany: db.custom },
  organizationAiCredential: { findMany: db.list, upsert: db.upsert, deleteMany: db.remove, findUnique: db.one },
} }));
vi.mock('@/server/security/secret-box', () => ({ sealSecret: (value: string) => `cifrada:${value}`, openSecret: (value: string) => value.replace('cifrada:', ''), secretHint: (value: string) => `••••${value.slice(-4)}` }));
import { deleteOrganizationAiKey, listOrganizationAiKeys, saveOrganizationAiKey, testOrganizationAiKey } from '@/server/settings/organization-ai-keys';
import type { OrgContext } from '@/server/auth/org-context';

const owner: OrgContext = { organizationId: 'org-a', userId: 'user-a', role: 'owner' };
const member: OrgContext = { ...owner, role: 'member' };
const KEY = 'clave-de-prueba-0000';
beforeEach(() => {
  vi.resetAllMocks();
  db.custom.mockResolvedValue([{ id: 'apimart', label: 'APIMart', baseUrl: 'https://api.apimart.ai/v1' }]);
  db.list.mockResolvedValue([{ provider: 'kie', keyHint: '••••0000', updatedAt: new Date() }]);
});

describe('ajustes de claves de IA de la organización', () => {
  it('lista integrados y compatibles con el estado de la organización del contexto, sin la clave', async () => {
    const keys = await listOrganizationAiKeys(owner);
    expect(db.list).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
    expect(keys.map((key) => key.provider)).toEqual(expect.arrayContaining(['openrouter', 'kie', 'openai', 'apimart']));
    expect(keys.find((key) => key.provider === 'kie')).toMatchObject({ configured: true, keyHint: '••••0000' });
    expect(JSON.stringify(keys)).not.toContain('cifrada');
  });

  it('guarda la clave cifrada en la organización del contexto', async () => {
    await saveOrganizationAiKey(owner, 'openrouter', `  ${KEY}  `);
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_provider: { organizationId: 'org-a', provider: 'openrouter' } },
      create: expect.objectContaining({ organizationId: 'org-a', encryptedApiKey: `cifrada:${KEY}`, keyHint: '••••0000' }),
    }));
  });

  it('un miembro sin rol de administración no guarda ni borra', async () => {
    await expect(saveOrganizationAiKey(member, 'openrouter', KEY)).rejects.toThrow(/propietario o un administrador/);
    await expect(deleteOrganizationAiKey(member, 'openrouter')).rejects.toThrow(/propietario o un administrador/);
    expect(db.upsert).not.toHaveBeenCalled(); expect(db.remove).not.toHaveBeenCalled();
  });

  it('rechaza proveedores desconocidos y claves incompletas', async () => {
    await expect(saveOrganizationAiKey(owner, 'typesafe', KEY)).rejects.toThrow(/no está disponible/);
    await expect(saveOrganizationAiKey(owner, 'kie', 'corta')).rejects.toThrow(/incompleta/);
  });

  it('borra solo la clave de su organización', async () => {
    await deleteOrganizationAiKey(owner, 'kie');
    expect(db.remove).toHaveBeenCalledWith({ where: { organizationId: 'org-a', provider: 'kie' } });
  });

  it('prueba la clave guardada sin generar y explica un rechazo', async () => {
    db.one.mockResolvedValue({ encryptedApiKey: `cifrada:${KEY}` });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 200, data: 42 }), { status: 200 }));
    await expect(testOrganizationAiKey(owner, 'openai')).resolves.toMatchObject({ ok: false, message: expect.stringMatching(/rechaza la clave/) });
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ headers: { Authorization: `Bearer ${KEY}` } }));
    await expect(testOrganizationAiKey(owner, 'kie')).resolves.toEqual({ ok: true, message: 'Clave válida. Saldo en KIE: 42 créditos.' });
    expect(db.one).toHaveBeenCalledWith({ where: { organizationId_provider: { organizationId: 'org-a', provider: 'kie' } } });
    fetchMock.mockRestore();
  });
});
