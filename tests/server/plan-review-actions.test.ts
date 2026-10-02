import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';

const auth = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => auth.ctx }));
vi.mock('server-only', () => ({}));

import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { acceptPlanReviewFix, reviewCurrentPlan } from '@/app/(app)/projects/[id]/_actions/plan-review-actions';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let ctx: OrgContext;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const user = await makeUser();
  ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
  auth.ctx = ctx;
  projectId = (await withOrg(ctx).projects.create({ title: 'Revisión de plano' })).id;
  const repo = withEditorDocuments(ctx);
  const legacy = await repo.load({ projectId });
  if (legacy.authority !== 'legacy') throw new Error('Se esperaba un proyecto sin Editor v2');
  const room = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 },
  ], true);
  const corner = room.vertices.find((vertex) => vertex.x === 4000 && vertex.y === 0)!;
  const stub = { id: crypto.randomUUID(), x: 3996, y: 4 };
  const document = {
    ...room,
    vertices: [...room.vertices, stub],
    walls: [...room.walls, {
      ...room.walls[0]!, id: crypto.randomUUID(),
      startVertexId: corner.id, endVertexId: stub.id,
    }],
  };
  await repo.activate({ projectId }, {
    document,
    expectedLegacyFingerprint: legacy.legacyFingerprint,
    confirmed: true,
  });
});

describe('revisor del plano guardado', () => {
  it('muestra una propuesta y solo la guarda tras aceptación en la revisión vigente', async () => {
    const reviewed = await reviewCurrentPlan(projectId);
    if ('actionError' in reviewed) throw new Error(reviewed.actionError);
    expect(reviewed.proposals).toEqual([expect.objectContaining({
      fix: 'collapse-degenerate-walls',
      removedWallIds: expect.arrayContaining([expect.any(String)]),
    })]);
    const before = await withEditorDocuments(ctx).load({ projectId });
    if (before.authority !== 'v2') throw new Error('Se esperaba Editor v2');
    expect(before.document.walls).toHaveLength(5);

    const accepted = await acceptPlanReviewFix(projectId, null, reviewed.revision, 'collapse-degenerate-walls');
    if ('actionError' in accepted) throw new Error(accepted.actionError);
    expect(accepted.revision).toBe(reviewed.revision + 1);
    const after = await withEditorDocuments(ctx).load({ projectId });
    if (after.authority !== 'v2') throw new Error('Se esperaba Editor v2');
    expect(after.document.walls).toHaveLength(4);
    expect(accepted.proposals).toEqual([]);
  });

  it('rechaza una aceptación obsoleta y un proyecto de otra organización', async () => {
    const reviewed = await reviewCurrentPlan(projectId);
    if ('actionError' in reviewed) throw new Error(reviewed.actionError);
    const first = await acceptPlanReviewFix(projectId, null, reviewed.revision, 'collapse-degenerate-walls');
    if ('actionError' in first) throw new Error(first.actionError);
    const stale = await acceptPlanReviewFix(projectId, null, reviewed.revision, 'collapse-degenerate-walls');
    expect(stale).toHaveProperty('actionError', expect.stringMatching(/cambió/));

    const other = await makeUser();
    auth.ctx = { organizationId: await makeOrg(), userId: other.id, role: 'owner' };
    await expect(reviewCurrentPlan(projectId)).rejects.toThrow('Proyecto o zona no encontrado');
  });
});
