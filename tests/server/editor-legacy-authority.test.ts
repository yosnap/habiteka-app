import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
const auth = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => auth.ctx }));
// Las Server Actions importan el storage marcado `server-only`; fuera de Next ese guard lanza.
vi.mock('server-only', () => ({}));
import { prisma } from '@/server/db/prisma';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { saveStudio } from '@/server/plan/studio-repo';
import { applyBaseImageToCanvas, saveCanvas } from '@/server/actions/canvas';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let ctx: OrgContext;
let projectId: string;
beforeEach(async () => {
  await resetDb();
  const user = await makeUser();
  ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
  auth.ctx = ctx;
  projectId = (await withOrg(ctx).projects.create({ title: 'Legacy fixture' })).id;
  await withOrg(ctx).canvas.save(projectId, { preserved: 'raw source' });
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
}
describe('actual legacy consumers respect v2 authority', () => {
  it('blocks repository and action writes as well as stale legacy reads', async () => {
    await activate();
    await expect(withOrg(ctx).canvas.save(projectId, { replaced: true })).rejects.toThrow('v2');
    await expect(saveCanvas(projectId, {})).rejects.toThrow('v2');
    await expect(withOrg(ctx).canvas.load(projectId)).rejects.toThrow('v2');
    expect((await prisma.canvasState.findFirstOrThrow({ where: { projectId } })).data).toEqual({
      preserved: 'raw source',
    });
  });
  it('blocks background application without modifying legacy snapshot', async () => {
    await activate();
    await expect(
      applyBaseImageToCanvas(projectId, {
        url: 'data:image/png;base64,aA==',
        width: 10,
        height: 10,
        opacity: 1,
      }),
    ).rejects.toThrow('v2');
    expect(await withEditorDocuments(ctx).readLegacySnapshot({ projectId })).toEqual({
      preserved: 'raw source',
    });
  });
  it('preserves legacy save/load and validates zone ownership', async () => {
    await withOrg(ctx).canvas.save(projectId, { working: true });
    expect(await withOrg(ctx).canvas.load(projectId)).toEqual({ working: true });
    const other = await withOrg(ctx).projects.create({ title: 'Other project' });
    const zone = await withOrg(ctx).zones.create(other.id, { name: 'Other zone' });
    await expect(withOrg(ctx).canvas.save(projectId, {}, zone.id)).rejects.toThrow('encontrado');
    expect(await withOrg(ctx).canvas.load(projectId, zone.id)).toBeNull();
  });
  it('agent editor send writes a v2 revision instead of a legacy payload', async () => {
    await activate();
    const { sendPlanoToEditor, generateDesignFromCanvas } =
      await import('@/app/(app)/projects/[id]/_actions/agent-actions');
    const before = await withEditorDocuments(ctx).load({ projectId });
    if (before.authority !== 'v2') throw new Error('Expected v2');
    const plano = {
      schemaVersion: 1,
      zones: [{
        id: 'z0', name: 'Sala', apertures: [], dimensions: [],
        outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }],
        walls: [
          { id: 'w0', from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thicknessMm: 120 },
          { id: 'w1', from: { x: 4000, y: 0 }, to: { x: 4000, y: 3000 }, thicknessMm: 120 },
          { id: 'w2', from: { x: 4000, y: 3000 }, to: { x: 0, y: 3000 }, thicknessMm: 120 },
          { id: 'w3', from: { x: 0, y: 3000 }, to: { x: 0, y: 0 }, thicknessMm: 120 },
        ],
      }],
    };
    await saveStudio(ctx, projectId, {
      sourceKind: 'drawing',
      source: { assetUrl: 'data:image/png;base64,YQ==' },
      plan: { assetUrl: 'data:image/png;base64,YQ==' },
      plano,
    });
    await sendPlanoToEditor(projectId);
    const after = await withEditorDocuments(ctx).load({ projectId });
    if (after.authority !== 'v2') throw new Error('Expected v2');
    expect(after.document.revision).toBeGreaterThan(before.document.revision);
    expect(after.document.walls.length).toBe(4);
    expect(after.document.walls.every((wall) => wall.dimensionalOrigin === 'raster')).toBe(true);
    // El snapshot legacy queda intacto: la escritura fue con autoridad de editor.
    await expect(withOrg(ctx).canvas.load(projectId)).rejects.toThrow('v2');
    await expect(generateDesignFromCanvas(projectId, {}, 'moderno', 'render3d')).rejects.toThrow(
      'v2',
    );
  });
});
