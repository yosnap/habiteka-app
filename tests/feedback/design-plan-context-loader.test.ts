import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ deliverable: { findFirst: vi.fn() }, iteration: { findFirst: vi.fn() },
  editorDocumentState: { findFirst: vi.fn() }, editorDocumentRevision: { findUnique: vi.fn() } }));
vi.mock('@/server/db/prisma', () => ({ prisma: db }));
import { loadDesignPlanContext } from '@/server/agent/feedback/design-plan-context';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

describe('referencia de versiones de diseño', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.editorDocumentState.findFirst.mockResolvedValue({ id: 'state', headRevision: 30 });
    const document = emptyEditorDocument();
    document.labels.push({ id: 'room', text: 'Cocina', x: 1000, y: 2000 });
    db.editorDocumentRevision.findUnique.mockResolvedValue({ document });
  });
  it('recupera la revisión y cámara del padre sin usar el plano posterior', async () => {
    const camera = { position: [0, 10, 0] }, generation = { documentRevision: 16 };
    db.deliverable.findFirst.mockResolvedValueOnce({ id: 'child', zoneId: null, payload: {} })
      .mockResolvedValueOnce({ id: 'parent', zoneId: null, payload: { camera, generation } });
    db.iteration.findFirst.mockResolvedValue({ deliverableId: 'parent' });
    const context = await loadDesignPlanContext('org', 'project', 'child');
    expect(context).toMatchObject({ camera, generation, source: 'generation-revision', documentRevision: 16 });
    expect(db.editorDocumentRevision.findUnique).toHaveBeenCalledWith({
      where: { stateId_revision: { stateId: 'state', revision: 16 } }, select: { document: true },
    });
    expect(db.deliverable.findFirst.mock.calls[0]?.[0].where).toMatchObject({ projectId: 'project', project: { organizationId: 'org' } });
  });
  it('no entrega contexto de un diseño ajeno', async () => {
    db.deliverable.findFirst.mockResolvedValue(null);
    expect(await loadDesignPlanContext('org', 'project', 'other')).toBeNull();
    expect(db.editorDocumentState.findFirst).not.toHaveBeenCalled();
  });
  it('declara explícitamente el plano actual cuando falta la referencia original', async () => {
    db.deliverable.findFirst.mockResolvedValue({ id: 'old', zoneId: null, payload: {} });
    db.iteration.findFirst.mockResolvedValue(null);
    expect(await loadDesignPlanContext('org', 'project', 'old')).toMatchObject({ source: 'current-editor', documentRevision: 30 });
  });
});
