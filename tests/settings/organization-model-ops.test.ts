import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ remove: vi.fn(), create: vi.fn(), transaction: vi.fn(), own: vi.fn(), keys: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  organizationModelRoute: { deleteMany: db.remove, createMany: db.create, findMany: db.own },
  organizationAiCredential: { findMany: db.keys },
  aiCustomProvider: { findMany: async () => [] },
  aiCustomModel: { findMany: async () => [] },
  $transaction: db.transaction,
} }));
import { listOrganizationModelUses, resetOrganizationModelUse, saveOrganizationModelUse } from '@/server/settings/organization-model-ops';
import type { OrgContext } from '@/server/auth/org-context';

const owner: OrgContext = { organizationId: 'org-a', userId: 'user-a', role: 'owner' };
const member: OrgContext = { ...owner, role: 'member' };
const sonnet = { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' };
beforeEach(() => {
  vi.resetAllMocks();
  db.remove.mockReturnValue('borrar'); db.create.mockReturnValue('crear');
  db.own.mockResolvedValue([]); db.keys.mockResolvedValue([{ provider: 'openrouter' }]);
});

describe('elección de modelos desde Mi perfil', () => {
  it('guarda la cadena de la organización del contexto en orden, reemplazando la anterior', async () => {
    await saveOrganizationModelUse(owner, 'chat', [sonnet, { provider: 'openrouter', model: 'openai/gpt-4o' }]);
    expect(db.remove).toHaveBeenCalledWith({ where: { organizationId: 'org-a', action: 'chat' } });
    expect(db.create).toHaveBeenCalledWith({ data: [
      { organizationId: 'org-a', action: 'chat', position: 0, ...sonnet },
      { organizationId: 'org-a', action: 'chat', position: 1, provider: 'openrouter', model: 'openai/gpt-4o' },
    ] });
    expect(db.transaction).toHaveBeenCalledWith(['borrar', 'crear']);
  });

  it('rechaza modelos fuera del catálogo, deprecados, repetidos o demasiados respaldos', async () => {
    await expect(saveOrganizationModelUse(owner, 'chat', [{ provider: 'openrouter', model: 'caro/inventado' }])).rejects.toThrow(/no está disponible/);
    await expect(saveOrganizationModelUse(owner, 'chat', [{ provider: 'openrouter', model: 'anthropic/claude-3.7-sonnet' }])).rejects.toThrow(/no está disponible/);
    await expect(saveOrganizationModelUse(owner, 'chat', [sonnet, sonnet])).rejects.toThrow(/No repitas/);
    await expect(saveOrganizationModelUse(owner, 'chat', [sonnet, sonnet, sonnet, sonnet, sonnet])).rejects.toThrow(/Como mucho 3/);
    await expect(saveOrganizationModelUse(owner, 'chat', [])).rejects.toThrow(/al menos un modelo/);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('un miembro sin rol de administración no cambia ni restablece modelos', async () => {
    await expect(saveOrganizationModelUse(member, 'chat', [sonnet])).rejects.toThrow(/propietario o un administrador/);
    await expect(resetOrganizationModelUse(member, 'chat')).rejects.toThrow(/propietario o un administrador/);
    expect(db.remove).not.toHaveBeenCalled();
  });

  it('restablecer borra solo la elección de su organización para ese uso', async () => {
    await resetOrganizationModelUse(owner, 'render3d');
    expect(db.remove).toHaveBeenCalledWith({ where: { organizationId: 'org-a', action: 'render3d' } });
  });

  it('lista cada uso con la recomendación, la elección propia y si hay clave para cada modelo', async () => {
    db.own.mockImplementation(async ({ where }: { where: { action: string } }) => where.action === 'chat' ? [sonnet] : []);
    const uses = await listOrganizationModelUses(owner);
    const chat = uses.find((use) => use.action === 'chat')!;
    expect(chat.recommended).toEqual([
      expect.objectContaining({ model: 'anthropic/claude-sonnet-5', providerLabel: 'OpenRouter', hasKey: true }),
      expect.objectContaining({ model: 'openai/gpt-5.2-chat' }),
    ]);
    expect(chat.own).toEqual([expect.objectContaining({ model: 'anthropic/claude-sonnet-5' })]);
    expect(chat.options.some((option) => option.model === 'anthropic/claude-3.7-sonnet')).toBe(false);
    expect(uses.find((use) => use.action === 'memoria')!.own).toBeNull();
    expect(db.keys).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
  });
});
