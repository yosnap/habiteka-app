import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ own: vi.fn(), recommended: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  organizationModelRoute: { findMany: db.own },
  aiCustomProvider: { findMany: async () => [] },
  aiCustomModel: { findMany: async () => [] },
} }));
vi.mock('@/server/ai/model-config-loader', () => ({ getModelRoutes: db.recommended }));
import { resolveRoutes } from '@/server/ai/model-routing';
import { invalidateCustomRegistry } from '@/server/ai/custom-ai-providers';

beforeEach(() => {
  vi.resetAllMocks();
  invalidateCustomRegistry();
  db.recommended.mockResolvedValue([{ provider: 'openrouter', model: 'openai/gpt-5.2-chat', baseURL: null }]);
});

describe('modelos elegidos por la organización', () => {
  it('sin elección propia usa la recomendación del panel', async () => {
    db.own.mockResolvedValue([]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ provider: 'openrouter', model: 'openai/gpt-5.2-chat' })]);
  });

  it('con elección propia manda su cadena, en su orden, y la consulta va por organización y uso', async () => {
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }, { provider: 'openrouter', model: 'openai/gpt-4o' }]);
    const routes = await resolveRoutes('chat', 'org-a');
    expect(routes.map((route) => route.model)).toEqual(['anthropic/claude-sonnet-5', 'openai/gpt-4o']);
    expect(db.own).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', action: 'chat' }, orderBy: { position: 'asc' } }));
  });

  it('descarta los modelos que el panel retiró o deprecó y, si no queda ninguno, vuelve a la recomendación', async () => {
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'anthropic/claude-3.7-sonnet' }, { provider: 'openrouter', model: 'modelo/retirado' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ model: 'openai/gpt-5.2-chat' })]);
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'modelo/retirado' }, { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ model: 'anthropic/claude-sonnet-5' })]);
  });

  it('si la tabla no se puede leer sigue con la recomendación', async () => {
    db.own.mockRejectedValue(new Error('relation does not exist'));
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ model: 'openai/gpt-5.2-chat' })]);
  });
});
