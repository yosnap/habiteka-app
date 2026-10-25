import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ provider: vi.fn(), upsertProvider: vi.fn(), credential: vi.fn(), upsertCredential: vi.fn(), upsertModel: vi.fn(), remove: vi.fn(), transaction: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  aiCustomProvider: { findUnique: db.provider, upsert: db.upsertProvider, deleteMany: db.remove },
  aiCustomModel: { upsert: db.upsertModel, deleteMany: db.remove },
  organizationAiCredential: { findUnique: db.credential, upsert: db.upsertCredential, deleteMany: db.remove },
  organizationModelRoute: { deleteMany: db.remove },
  $transaction: db.transaction,
} }));
vi.mock('@/server/security/secret-box', () => ({ sealSecret: (value: string) => `cifrada:${value}`, openSecret: (value: string) => value.replace('cifrada:', ''), secretHint: () => '••••0000' }));
import { deleteCompatibleProvider, listProviderCatalog, saveCompatibleProvider, saveEnabledModel, validBaseUrl } from '@/server/settings/organization-catalog-ops';
import type { OrgContext } from '@/server/auth/org-context';

const owner: OrgContext = { organizationId: 'org-a', userId: 'user-a', role: 'owner' };
const member: OrgContext = { ...owner, role: 'member' };
const KEY = 'clave-de-prueba-0000';
beforeEach(() => { vi.resetAllMocks(); db.remove.mockReturnValue('borrar'); });

describe('catálogo de IA de la organización', () => {
  it('da de alta un proveedor compatible en su organización y cifra su clave', async () => {
    db.provider.mockResolvedValue(null); db.credential.mockResolvedValue(null);
    await expect(saveCompatibleProvider(owner, { label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1/', apiKey: KEY })).resolves.toBe('nodeclub');
    expect(db.upsertProvider).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_id: { organizationId: 'org-a', id: 'nodeclub' } },
      create: { organizationId: 'org-a', id: 'nodeclub', label: 'NodeClub.ai', baseUrl: 'https://api.nodeclub.ai/v1' },
    }));
    expect(db.upsertCredential).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ organizationId: 'org-a', provider: 'nodeclub', encryptedApiKey: `cifrada:${KEY}` }) }));
  });

  it('exige pegar de nuevo la clave si cambia la URL: la clave solo viaja a la URL con que se guardó', async () => {
    db.provider.mockResolvedValue({ id: 'nodeclub', label: 'NodeClub', baseUrl: 'https://api.nodeclub.ai/v1' });
    db.credential.mockResolvedValue({ provider: 'nodeclub' });
    await expect(saveCompatibleProvider(owner, { id: 'nodeclub', label: 'NodeClub', baseUrl: 'https://otro.example.com/v1', apiKey: '' })).rejects.toThrow(/Pega la API key/);
    expect(db.upsertProvider).not.toHaveBeenCalled();
  });

  it('rechaza URLs locales, privadas, sin https o con credenciales', () => {
    for (const url of ['http://api.example.com/v1', 'https://localhost/v1', 'https://10.0.0.2/v1', 'https://192.168.1.10/v1', 'https://u:p@api.example.com', 'https://api.example.com/v1?x=1'])
      expect(() => validBaseUrl(url)).toThrow();
    expect(validBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('un miembro sin rol de administración no cambia el catálogo', async () => {
    await expect(saveCompatibleProvider(member, { label: 'X', baseUrl: 'https://api.x.com', apiKey: KEY })).rejects.toThrow(/propietario o un administrador/);
    await expect(deleteCompatibleProvider(member, 'apimart')).rejects.toThrow(/propietario o un administrador/);
    await expect(saveEnabledModel(member, { providerId: 'openrouter', model: 'x/y', label: 'Y', actions: ['chat'], priceUsdPerUnit: 1 })).rejects.toThrow(/propietario o un administrador/);
  });

  it('habilita un modelo con su precio en su organización, sin techo de precio: lo paga la organización', async () => {
    await saveEnabledModel(owner, { providerId: 'openrouter', model: 'vendor/caro', label: 'Caro', actions: ['chat', 'render3d' as never], priceUsdPerUnit: 60 });
    expect(db.upsertModel).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_providerId_model: { organizationId: 'org-a', providerId: 'openrouter', model: 'vendor/caro' } },
      create: expect.objectContaining({ organizationId: 'org-a', actions: ['chat'], priceUsdPerUnit: 60 }),
    }));
  });

  it('borrar un proveedor quita solo lo de su organización: clave, modelos y elecciones que lo usaban', async () => {
    await deleteCompatibleProvider(owner, 'apimart');
    for (const [args] of db.remove.mock.calls) expect(args.where).toMatchObject({ organizationId: 'org-a' });
    expect(db.remove).toHaveBeenCalledTimes(4);
  });

  it('lista los modelos del proveedor con la clave de la organización', async () => {
    db.credential.mockResolvedValue({ encryptedApiKey: `cifrada:${KEY}` });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a', pricing: { prompt: '0.000002' }, architecture: { input_modalities: ['text'] } }] }), { status: 200 }));
    await expect(listProviderCatalog(owner, 'openrouter')).resolves.toEqual({ models: [{ id: 'a', priceUsdPerMillion: 2, vision: false }, { id: 'b' }] });
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', expect.objectContaining({ headers: { Authorization: `Bearer ${KEY}` }, redirect: 'error' }));
    expect(db.credential).toHaveBeenCalledWith({ where: { organizationId_provider: { organizationId: 'org-a', provider: 'openrouter' } } });
    fetchMock.mockRestore();
  });
});
