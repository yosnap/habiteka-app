import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
const auth = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
const agent = vi.hoisted(() => ({ advance: vi.fn(async () => ({ phase: 'cualificacion', messages: [] })) }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => auth.ctx }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/agent', () => ({ getAgent: async () => agent }));
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let ctx: OrgContext;
let projectId: string;
beforeEach(async () => {
  await resetDb();
  agent.advance.mockClear();
  const user = await makeUser();
  ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
  auth.ctx = ctx;
  projectId = (await withOrg(ctx).projects.create({ title: 'Proyecto v2' })).id;
  const repo = withEditorDocuments(ctx);
  const state = await repo.load({ projectId });
  if (state.authority !== 'legacy') throw new Error('Expected legacy');
  await repo.activate({ projectId }, { document: emptyEditorDocument(), confirmed: true, expectedLegacyFingerprint: state.legacyFingerprint });
});

describe('el chat de un proyecto con editor v2', () => {
  it('avanza y entrega sin pasar por la puerta del lienzo antiguo', async () => {
    const { advanceAgent } = await import('@/app/(app)/projects/[id]/_actions/agent-actions');
    const outcome = await advanceAgent(projectId, { action: 'deliver' });
    expect(outcome).toEqual({ phase: 'cualificacion', messages: [] });
    expect(agent.advance).toHaveBeenCalledWith(projectId, { action: 'deliver' }, null);
  });
  it('sigue rechazando proyectos de otra organización', async () => {
    const { advanceAgent } = await import('@/app/(app)/projects/[id]/_actions/agent-actions');
    const outsider = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' as const };
    auth.ctx = outsider;
    expect(await advanceAgent(projectId, { action: 'deliver' })).toEqual({ actionError: 'Proyecto no encontrado en tu organización' });
    expect(agent.advance).not.toHaveBeenCalled();
  });
  it('el flujo del lienzo antiguo sigue bloqueado para planos migrados', async () => {
    const { generateDesignFromCanvas } = await import('@/app/(app)/projects/[id]/_actions/agent-actions');
    await expect(generateDesignFromCanvas(projectId, {}, 'moderno', 'render3d')).rejects.toThrow('v2');
  });
});
