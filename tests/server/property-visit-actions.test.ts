import { beforeEach, describe, expect, it, vi } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), approvals: vi.fn(), sources: vi.fn(), spend: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: mocks.auth }));
vi.mock('@/server/editor/document-repo', () => ({ withEditorDocuments: () => ({ listApprovals: mocks.approvals }) }));
vi.mock('@/server/walkthrough/design-video-sources', () => ({ designVideoSources: mocks.sources }));
vi.mock('@/server/ai/provider-key-resolver', () => ({ resolveKieKey: mocks.spend }));
import { inspectPropertyVisit } from '@/server/walkthrough/property-visit-actions';
const ctx = { organizationId: 'org', userId: 'user', role: 'owner' }, scope = { projectId: 'project', zoneId: 'zone' };
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue(ctx);
  mocks.approvals.mockResolvedValue([{ id: 'approval', revision: 7 }]);
  mocks.sources.mockResolvedValue({ approved: { id: 'approval', revision: 7, document: twoRoomDocument() }, rows: [], references: [] });
});
describe('preparación gratuita del paseo completo', () => {
  it('mantiene el ámbito autenticado y la aprobación seleccionada; no necesita proveedor', async () => {
    const report = await inspectPropertyVisit(scope, { approvalId: 'approval', lighting: 'daylight' });
    expect(mocks.sources).toHaveBeenCalledWith(ctx, scope, 'approval');
    expect(report.approvalId).toBe('approval'); expect(report.plan.coverage).toHaveLength(2);
    expect(report.generationIssue).toContain('Guarda el paseo');
    expect(mocks.spend).not.toHaveBeenCalled();
  });
  it('detiene la lectura si no hay sesión o el origen no pertenece al ámbito', async () => {
    mocks.auth.mockRejectedValueOnce(new Error('Sin sesión'));
    await expect(inspectPropertyVisit(scope)).rejects.toThrow('Sin sesión');
    expect(mocks.sources).not.toHaveBeenCalled();
    mocks.sources.mockRejectedValueOnce(new Error('Origen de otra organización'));
    await expect(inspectPropertyVisit(scope, { approvalId: 'other' })).rejects.toThrow('otra organización');
  });
  it('no prepara un paseo sin versión aprobada', async () => {
    mocks.sources.mockResolvedValueOnce({ approved: null });
    await expect(inspectPropertyVisit(scope)).rejects.toThrow('Revisa una versión');
  });
  it('rechaza parámetros ajenos al contrato antes de leer datos', async () => {
    await expect(inspectPropertyVisit(scope, { approvalId: '' })).rejects.toThrow();
    expect(mocks.sources).not.toHaveBeenCalled();
  });
});
