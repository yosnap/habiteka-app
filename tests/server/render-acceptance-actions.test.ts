import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
const fixture = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => fixture.ctx }));
import { prisma } from '@/server/db/prisma';
import { makeOrg, makeUser, resetDb } from '../helpers/db';
import { setRenderAcceptance } from '@/server/walkthrough/render-acceptance-actions';

let projectId: string;
beforeEach(async () => {
  await resetDb();
  fixture.ctx = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' };
  projectId = (await prisma.project.create({ data: { organizationId: fixture.ctx.organizationId, title: 'Aceptación de prueba' } })).id;
});
async function image(provider = 'kie', generation: object = {}) {
  return prisma.deliverable.create({ data: { projectId, type: 'RENDER_3D', legalSeal: 'Prueba', payload: {
    type: 'render3d', assetKey: 'renders/test.png', generation: { provider, documentRevision: 1, ...generation } } } });
}
describe('aceptación explícita de diseño', () => {
  it('registra decisión humana y permite retirarla conservando archivo y geometría de referencia', async () => {
    const row = await image();
    const result = await setRenderAcceptance({ projectId }, row.id, row.version, true);
    expect(result).toMatchObject({ accepted: true, version: row.version + 1 });
    const accepted = await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } });
    expect(accepted.payload).toMatchObject({ assetKey: 'renders/test.png', generation: { acceptance: { userId: fixture.ctx!.userId } } });
    await setRenderAcceptance({ projectId }, row.id, accepted.version, false);
    const withdrawn = await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } });
    expect(withdrawn.payload).toMatchObject({ assetKey: 'renders/test.png', generation: { provider: 'kie' } });
    expect((withdrawn.payload as { generation: { acceptance?: unknown } }).generation.acceptance).toBeUndefined();
  });
  it('no acepta imágenes nativas o rechazadas', async () => {
    const native = await image('native'), rejected = await image('kie', { review: { status: 'rejected', reason: 'Cambió paredes' } });
    await expect(setRenderAcceptance({ projectId }, native.id, native.version, true)).rejects.toThrow('generados con IA');
    await expect(setRenderAcceptance({ projectId }, rejected.id, rejected.version, true)).rejects.toThrow('Cambió paredes');
  });
  it('bloquea una auditoría rechazada aunque no haya review', async () => {
    const row = await image('kie', { fidelity: { status: 'rejected' } });
    await expect(setRenderAcceptance({ projectId }, row.id, row.version, true)).rejects.toThrow('revisión visual');
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(row.version);
  });
  it('bloquea versión antigua, zona ajena y organización ajena sin modificar la aceptación', async () => {
    const row = await image();
    await expect(setRenderAcceptance({ projectId }, row.id, row.version + 1, true)).rejects.toThrow('ha cambiado');
    const zone = await prisma.projectZone.create({ data: { projectId, organizationId: fixture.ctx!.organizationId, name: 'Otra zona' } });
    await expect(setRenderAcceptance({ projectId, zoneId: zone.id }, row.id, row.version, true)).rejects.toThrow('ámbito');
    fixture.ctx = { ...fixture.ctx!, organizationId: await makeOrg() };
    await expect(setRenderAcceptance({ projectId }, row.id, row.version, true)).rejects.toThrow('no encontrado');
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(row.version);
  });
  it('no acepta imágenes en la papelera', async () => {
    const row = await image();
    await prisma.deliverable.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
    await expect(setRenderAcceptance({ projectId }, row.id, row.version, true)).rejects.toThrow('ámbito');
  });
});
