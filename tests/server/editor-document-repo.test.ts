import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { makeOrg, makeUser, resetDb } from '../helpers/db';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { OrgContext } from '@/server/auth/org-context';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { approvedAssets, approvedAssetsMatch } from '@/lib/editor-document/approved-design';

let ctx: OrgContext;
let projectId: string;
beforeEach(async () => {
  await resetDb();
  const user = await makeUser();
  ctx = { userId: user.id, organizationId: await makeOrg(), role: 'owner' };
  projectId = (
    await prisma.project.create({
      data: { title: 'Editor fixture', organizationId: ctx.organizationId },
    })
  ).id;
});
async function activate(document = emptyEditorDocument()) {
  const repo = withEditorDocuments(ctx);
  const state = await repo.load({ projectId });
  if (state.authority !== 'legacy') throw new Error('Expected legacy');
  await repo.activate(
    { projectId },
    {
      document,
      confirmed: true,
      expectedLegacyFingerprint: state.legacyFingerprint,
    },
  );
  return repo;
}
describe('revisioned editor repository', () => {
  it('fija la revisión aprobada y deja el borrador posterior independiente', async () => {
    const sample = visualSampleDocument();
    const repo = await activate(sample);
    const first = await repo.approve({ projectId }, 0, 'warm');
    expect(first.revision).toBe(0);
    expect(first.lightingPreset).toBe('warm');
    expect(first.assets.some((asset) => asset.itemId === 'sofa' && asset.sha256)).toBe(true);
    expect(approvedAssetsMatch(first.document, first.assets)).toBe(true);
    const next = structuredClone(sample);
    next.furniture.find((item) => item.id === 'sofa')!.x += 300;
    expect((await repo.save({ projectId }, { document: next, expectedRevision: 0, requestKey: 'move-sofa' })).status).toBe('saved');
    expect((await repo.readApproval({ projectId }, first.id)).document.furniture.find((item) => item.id === 'sofa')!.x).toBe(500);
    expect((await repo.latestApproval({ projectId }))?.id).toBe(first.id);
    const second = await repo.approve({ projectId }, 1, 'daylight');
    expect(second.id).not.toBe(first.id);
    expect((await repo.latestApproval({ projectId }))?.id).toBe(second.id);
    expect((await repo.listApprovals({ projectId })).map((item) => item.id)).toEqual([second.id, first.id]);
    expect((await repo.readApproval({ projectId }, first.id)).lightingPreset).toBe('warm');
    await expect(repo.approve({ projectId }, 1, 'evening')).rejects.toThrow(/otra iluminación/);
    expect(approvedAssets(second.document)).toEqual(second.assets);
  });
  it('bloquea planos sin estancias, revisión obsoleta y acceso ajeno', async () => {
    const repo = await activate();
    await expect(repo.approve({ projectId }, 0, 'daylight')).rejects.toThrow(/estancia/);
    const sample = visualSampleDocument();
    await repo.save({ projectId }, { document: sample, expectedRevision: 0, requestKey: 'ready' });
    await expect(repo.approve({ projectId }, 0, 'daylight')).rejects.toThrow(/cambió/);
    const otherCtx = { ...ctx, organizationId: await makeOrg() };
    await expect(withEditorDocuments(otherCtx).approve({ projectId }, 1, 'daylight')).rejects.toThrow(/encontrado/);
    expect(await withEditorDocuments(otherCtx).listApprovals({ projectId }).catch((error: Error) => error.message)).toMatch(/encontrado/);
  });
  it('keeps legacy raw snapshot, without auto activation or normalization', async () => {
    const raw = { version: 88, unknown: { field: 'preserve' }, walls: [{ id: 'special' }] };
    await prisma.canvasState.create({ data: { projectId, data: raw } });
    const repo = withEditorDocuments(ctx);
    const state = await repo.load({ projectId });
    expect(state).toMatchObject({ authority: 'legacy', legacySnapshot: raw });
    expect(await prisma.editorDocumentState.count()).toBe(0);
    if (state.authority !== 'legacy') throw new Error('Expected legacy');
    await repo.activate(
      { projectId },
      {
        document: emptyEditorDocument(),
        confirmed: true,
        expectedLegacyFingerprint: state.legacyFingerprint,
      },
    );
    expect(await repo.readLegacySnapshot({ projectId })).toEqual(raw);
  });
  it('two clients against the same revision yield one success and one conflict', async () => {
    const repo = await activate();
    const results = await Promise.all(
      ['client-a', 'client-b'].map((requestKey) =>
        repo.save(
          { projectId },
          { document: emptyEditorDocument(), expectedRevision: 0, requestKey },
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual(['conflict', 'saved']);
    expect(await prisma.editorDocumentRevision.count()).toBe(2);
    expect((await repo.readRevision({ projectId }, 0)).revision).toBe(0);
  });
  it('replays a save key once and rejects reuse for another payload', async () => {
    const repo = await activate();
    const input = { document: emptyEditorDocument(), expectedRevision: 0, requestKey: 'same-key' };
    const results = await Promise.all([
      repo.save({ projectId }, input),
      repo.save({ projectId }, input),
    ]);
    expect(results[0]).toEqual(results[1]);
    const altered = emptyEditorDocument();
    altered.labels.push({ id: 'label', x: 0, y: 0, text: 'Changed' });
    await expect(repo.save({ projectId }, { ...input, document: altered })).rejects.toThrow(
      'clave',
    );
    expect(await prisma.editorDocumentRevision.count()).toBe(2);
  });
  it('lista versiones y recupera una anterior como revisión nueva sin alterar la actual ni la aprobada', async () => {
    const first = visualSampleDocument();
    const repo = await activate(first);
    const approved = await repo.approve({ projectId }, 0, 'daylight');
    const second = structuredClone(first);
    second.furniture = [];
    await repo.save({ projectId }, { document: second, expectedRevision: 0, requestKey: 'clear-furniture' });
    const history = await repo.listRevisions({ projectId });
    expect(history).toMatchObject({ headRevision: 1, total: 2 });
    expect(history.revisions.map((item) => [item.revision, item.furniture])).toEqual([
      [1, 0], [0, first.furniture.length],
    ]);
    const source = await repo.readRevision({ projectId }, 0);
    const restored = await repo.save({ projectId }, {
      document: { ...source, revision: 1 }, expectedRevision: 1, requestKey: 'restore:0:1',
    });
    expect(restored.status).toBe('saved');
    expect(restored.document.revision).toBe(2);
    expect(restored.document.furniture).toEqual(first.furniture);
    expect((await repo.readRevision({ projectId }, 1)).furniture).toEqual([]);
    expect((await repo.readApproval({ projectId }, approved.id)).revision).toBe(0);
    await expect(withEditorDocuments({ ...ctx, organizationId: await makeOrg() })
      .listRevisions({ projectId })).rejects.toThrow('encontrado');
  });
  it('rejects cross-org and foreign/deleted zones', async () => {
    await activate();
    const otherCtx = { ...ctx, organizationId: await makeOrg() };
    await expect(withEditorDocuments(otherCtx).load({ projectId })).rejects.toThrow('encontrado');
    const otherProject = await prisma.project.create({
      data: { title: 'Other', organizationId: ctx.organizationId },
    });
    const zone = await prisma.projectZone.create({
      data: { name: 'Other zone', organizationId: ctx.organizationId, projectId: otherProject.id },
    });
    await expect(withEditorDocuments(ctx).load({ projectId, zoneId: zone.id })).rejects.toThrow(
      'encontrado',
    );
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
    await expect(withEditorDocuments(ctx).readRevision({ projectId }, 0)).rejects.toThrow(
      'encontrado',
    );
  });
  it('rejects stale migration preview and preserves raw snapshot', async () => {
    const repo = withEditorDocuments(ctx);
    const state = await repo.load({ projectId });
    if (state.authority !== 'legacy') throw new Error('Expected legacy');
    await prisma.canvasState.create({ data: { projectId, data: { changed: true } } });
    await expect(
      repo.activate(
        { projectId },
        {
          document: emptyEditorDocument(),
          confirmed: true,
          expectedLegacyFingerprint: state.legacyFingerprint,
        },
      ),
    ).rejects.toThrow('cambió');
    expect(await prisma.editorDocumentState.count()).toBe(0);
  });
});
