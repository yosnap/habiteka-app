import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ own: vi.fn(), providers: vi.fn(), models: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  organizationModelRoute: { findMany: db.own },
  aiCustomProvider: { findMany: db.providers },
  aiCustomModel: { findMany: db.models },
} }));
import { resolveRoutes } from '@/server/ai/model-routing';

beforeEach(() => {
  vi.resetAllMocks();
  db.providers.mockResolvedValue([]); db.models.mockResolvedValue([]);
});
// Recomendación fija de Habiteka para el asistente: Claude Sonnet 5 y, de respaldo, GPT-5.2.
const RECOMMENDED = ['anthropic/claude-sonnet-5', 'openai/gpt-5.2-chat'];

describe('modelos y catálogo de la organización', () => {
  it('sin elección propia usa la recomendación de Habiteka, con su precio', async () => {
    db.own.mockResolvedValue([]);
    const routes = await resolveRoutes('chat', 'org-a');
    expect(routes.map((route) => route.model)).toEqual(RECOMMENDED);
    expect(routes[0]).toMatchObject({ provider: 'openrouter', priceUsdPerUnit: expect.any(Number) });
  });

  it('usa los proveedores y modelos del catálogo de la organización, con su URL y su precio', async () => {
    db.providers.mockResolvedValue([{ id: 'apimart', label: 'APIMart', baseUrl: 'https://api.apimart.ai/v1' }]);
    db.models.mockResolvedValue([{ providerId: 'apimart', model: 'claude-x', label: 'Claude X', actions: ['chat'], priceUsdPerUnit: 1.5 }]);
    db.own.mockResolvedValue([{ provider: 'apimart', model: 'claude-x' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ provider: 'apimart', baseURL: 'https://api.apimart.ai/v1', priceUsdPerUnit: 1.5 })]);
    expect(db.providers).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
    expect(db.models).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
  });

  it('un modelo de un proveedor que no está en el catálogo de la organización se descarta', async () => {
    db.own.mockResolvedValue([{ provider: 'apimart', model: 'claude-x' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual(RECOMMENDED.map((model) => expect.objectContaining({ model })));
  });

  it('con elección propia manda su cadena, en su orden, y la consulta va por organización y uso', async () => {
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }, { provider: 'openrouter', model: 'openai/gpt-4o' }]);
    const routes = await resolveRoutes('chat', 'org-a');
    expect(routes.map((route) => route.model)).toEqual(['anthropic/claude-sonnet-5', 'openai/gpt-4o']);
    expect(db.own).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', action: 'chat' }, orderBy: { position: 'asc' } }));
  });

  it('descarta los modelos que el panel retiró o deprecó y, si no queda ninguno, vuelve a la recomendación', async () => {
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'anthropic/claude-3.7-sonnet' }, { provider: 'openrouter', model: 'modelo/retirado' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual(RECOMMENDED.map((model) => expect.objectContaining({ model })));
    db.own.mockResolvedValue([{ provider: 'openrouter', model: 'modelo/retirado' }, { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }]);
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual([expect.objectContaining({ model: 'anthropic/claude-sonnet-5' })]);
  });

  it('si la tabla no se puede leer sigue con la recomendación', async () => {
    db.own.mockRejectedValue(new Error('relation does not exist'));
    await expect(resolveRoutes('chat', 'org-a')).resolves.toEqual(RECOMMENDED.map((model) => expect.objectContaining({ model })));
  });
});
