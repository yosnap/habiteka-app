import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { makeOrg, makeUser, resetDb } from '../helpers/db';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { withLegacyAuthority } from '@/server/editor/authority';
import type { OrgContext } from '@/server/auth/org-context';

let ctx: OrgContext;
let projectId: string;
beforeEach(async () => {
  await resetDb();
  const user = await makeUser();
  ctx = { userId: user.id, organizationId: await makeOrg(), role: 'owner' };
  projectId = (
    await prisma.project.create({
      data: { title: 'Authority fixture', organizationId: ctx.organizationId },
    })
  ).id;
});
async function activationInput() {
  const state = await withEditorDocuments(ctx).load({ projectId });
  if (state.authority !== 'legacy') throw new Error('Expected legacy');
  return {
    document: emptyEditorDocument(),
    confirmed: true as const,
    expectedLegacyFingerprint: state.legacyFingerprint,
  };
}

describe('editor authority transitions', () => {
  it('rejects legacy writes after explicit activation without invoking writer', async () => {
    await withEditorDocuments(ctx).activate({ projectId }, await activationInput());
    const writer = vi.fn();
    await expect(withLegacyAuthority(ctx, { projectId }, writer)).rejects.toThrow('v2');
    expect(writer).not.toHaveBeenCalled();
  });
  it('serializes activation against an in-flight guarded legacy write', async () => {
    const input = await activationInput();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const legacy = withLegacyAuthority(ctx, { projectId }, async (tx) => {
      started();
      await gate;
      await tx.canvasState.create({ data: { projectId, data: { late: 'legacy write' } } });
    });
    await entered;
    const activation = withEditorDocuments(ctx).activate({ projectId }, input);
    release();
    await legacy;
    await expect(activation).rejects.toThrow('cambió');
    expect(await prisma.editorDocumentState.count()).toBe(0);
  });
  it('does not transfer default-project authority to a named zone', async () => {
    const repo = withEditorDocuments(ctx);
    await repo.activate({ projectId }, await activationInput());
    const zone = await prisma.projectZone.create({
      data: { projectId, organizationId: ctx.organizationId, name: 'Kitchen' },
    });
    expect((await repo.load({ projectId, zoneId: zone.id })).authority).toBe('legacy');
    await prisma.projectZone.update({ where: { id: zone.id }, data: { deletedAt: new Date() } });
    await expect(repo.load({ projectId, zoneId: zone.id })).rejects.toThrow('encontrado');
  });
  it('keeps v2 readable when writes are paused', async () => {
    const repo = withEditorDocuments(ctx);
    await repo.activate({ projectId }, await activationInput());
    await prisma.editorDocumentState.updateMany({
      where: { projectId },
      data: { writable: false },
    });
    expect(await repo.load({ projectId })).toMatchObject({ authority: 'v2', writable: false });
    await expect(
      repo.save(
        { projectId },
        { document: emptyEditorDocument(), expectedRevision: 0, requestKey: 'new' },
      ),
    ).rejects.toThrow('solo lectura');
    expect(await repo.readRevision({ projectId }, 0)).toEqual(emptyEditorDocument());
  });
  it('enforces immutable snapshots and revisions in the database', async () => {
    await withEditorDocuments(ctx).activate({ projectId }, await activationInput());
    const state = await prisma.editorDocumentState.findFirstOrThrow({ where: { projectId } });
    await expect(
      prisma.editorDocumentState.update({
        where: { id: state.id },
        data: { legacySnapshot: { changed: true } },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.editorDocumentRevision.update({
        where: { stateId_revision: { stateId: state.id, revision: 0 } },
        data: { fingerprint: 'changed' },
      }),
    ).rejects.toThrow();
    expect((await withEditorDocuments(ctx).readRevision({ projectId }, 0)).revision).toBe(0);
  });
});
