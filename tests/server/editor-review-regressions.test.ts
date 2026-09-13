import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

describe('frontera real de autoridad de editor', () => {
  it('el escritor legacy productivo rechaza guardar tras activar v2', async () => {
    await resetDb();
    const user = await makeUser();
    const ctx = { userId: user.id, organizationId: await makeOrg(), role: 'owner' as const };
    const project = await prisma.project.create({ data: { title: 'Review', organizationId: ctx.organizationId } });
    const scope = { projectId: project.id };
    const editor = withEditorDocuments(ctx);
    const loaded = await editor.load(scope);
    if (loaded.authority !== 'legacy') throw new Error('Expected legacy');
    await editor.activate(scope, { document: emptyEditorDocument(), confirmed: true,
      expectedLegacyFingerprint: loaded.legacyFingerprint });
    await expect(withOrg(ctx).canvas.save(project.id, { overwritten: true })).rejects.toThrow(/v2/);
    expect(await prisma.canvasState.count({ where: { projectId: project.id } })).toBe(0);
  });
});
