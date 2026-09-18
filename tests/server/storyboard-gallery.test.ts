import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), repo: vi.fn(), list: vi.fn(), url: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/db/scoped-repo', () => ({ withOrg: mocks.repo }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: mocks.url }));
import { listStoryboardImages } from '@/server/walkthrough/storyboard-gallery';
const camera = { position: [1, 1.6, 2], focus: [2, 1.6, 2], fovDeg: 75, levelId: null };
const row = { id: 'render', version: 1, zoneId: null, payload: { type: 'render3d', camera, assetKey: 'stored-key' } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user', organizationId: 'org' });
  mocks.repo.mockReturnValue({ deliverables: { list: mocks.list } });
  mocks.list.mockResolvedValue([row]); mocks.url.mockResolvedValue('https://storage.test/fresh');
});
describe('galería con ámbito de storyboard', () => {
  it('usa identidad de sesión, repositorio scoped y URL fresca sin exponer claves', async () => {
    const result = await listStoryboardImages({ projectId: 'project' });
    expect(mocks.repo).toHaveBeenCalledWith({ userId: 'user', organizationId: 'org' });
    expect(mocks.list).toHaveBeenCalledWith('project');
    expect(result).toEqual([{ id: 'render', label: 'Render · versión 1', camera, assetUrl: 'https://storage.test/fresh' }]);
    expect(mocks.url).toHaveBeenCalledWith(row.payload);
  });
  it('excluye otras zonas, vídeos y cámaras ausentes o inválidas antes de resolver storage', async () => {
    mocks.list.mockResolvedValue([{ ...row, zoneId: 'other' }, { ...row, payload: { type: 'video' } },
      { ...row, payload: { type: 'render3d' } }, { ...row, payload: { type: 'render3d', camera: {} } }]);
    expect(await listStoryboardImages({ projectId: 'project' })).toEqual([]);
    expect(mocks.url).not.toHaveBeenCalled();
  });
  it('rechaza falta de sesión y omite URLs no seguras', async () => {
    mocks.auth.mockRejectedValueOnce(new Error('Sin sesión'));
    await expect(listStoryboardImages({ projectId: 'project' })).rejects.toThrow('Sin sesión');
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.url.mockResolvedValue('javascript:alert(1)');
    expect(await listStoryboardImages({ projectId: 'project' })).toEqual([]);
  });
});
