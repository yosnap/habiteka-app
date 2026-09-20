import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { makeOrg, makeUser, resetDb } from '../helpers/db';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { OrgContext } from '@/server/auth/org-context';

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
async function activate() {
  const repo = withEditorDocuments(ctx);
  const state = await repo.load({ projectId });
  if (state.authority !== 'legacy') throw new Error('Expected legacy');
  await repo.activate(
    { projectId },
    {
      document: emptyEditorDocument(),
      confirmed: true,
      expectedLegacyFingerprint: state.legacyFingerprint,
    },
  );
  return repo;
}
describe('revisioned editor repository', () => {
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
