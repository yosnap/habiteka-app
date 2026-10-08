import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
const fixture = vi.hoisted(() => ({ ctx: null as OrgContext | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => fixture.ctx }));
vi.mock('@/server/storage/render-urls', () => ({ resolveRenderUrl: async () => 'https://storage.example/image.png' }));
import { prisma } from '@/server/db/prisma';
import { makeOrg, makeUser, resetDb } from '../helpers/db';
import { listStudioDeletedImages, removeStudioImages, restoreStudioImages, renameStudioVideo } from '@/server/walkthrough/studio-media-actions';
import { callAction } from '@/lib/action-result';
import { readVideoTitle } from '@/lib/editor-document/video-title';
import { readDesignVideoJob } from '@/server/walkthrough/design-video-jobs';

let projectId: string, zoneId: string;
beforeEach(async () => {
  await resetDb();
  fixture.ctx = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' };
  projectId = (await prisma.project.create({ data: { organizationId: fixture.ctx.organizationId, title: 'Medios de prueba' } })).id;
  zoneId = (await prisma.projectZone.create({ data: { projectId, organizationId: fixture.ctx.organizationId, name: 'Zona' } })).id;
});
async function image(input: { projectId?: string; zoneId?: string | null; type?: 'RENDER_3D' | 'VIDEO'; payload?: object } = {}) {
  return prisma.deliverable.create({ data: { projectId: input.projectId ?? projectId, zoneId: input.zoneId ?? null, type: input.type ?? 'RENDER_3D',
    payload: input.payload ?? { type: 'render3d', assetKey: 'renders/fixture.png', generation: { review: { status: 'rejected' }, view: { preset: 'left' } } }, legalSeal: 'Prueba' } });
}
describe('limpieza de medios y nombres con PostgreSQL real', () => {
  it('quita imágenes rechazadas en lote, conserva su contenido y permite restaurar después de volver a listar', async () => {
    const rows = [await image(), await image()], ids = rows.map(row => row.id);
    await callAction(removeStudioImages({ projectId }, ids));
    expect(await prisma.deliverable.count({ where: { id: { in: ids }, deletedAt: { not: null } } })).toBe(2);
    const trash = await callAction(listStudioDeletedImages({ projectId }));
    expect(trash.map(row => row.id).sort()).toEqual(ids.sort());
    await callAction(restoreStudioImages({ projectId }, [ids[0]!]));
    const restored = await prisma.deliverable.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(restored.deletedAt).toBeNull(); expect(restored.payload).toEqual(rows[0]!.payload); expect(restored.version).toBe(3);
    expect((await callAction(listStudioDeletedImages({ projectId }))).map(row => row.id)).toEqual([ids[1]]);
  });
  it('rechaza un lote parcialmente ajeno o de otra zona sin borrar su parte válida', async () => {
    const own = await image(), otherZone = await image({ zoneId });
    const otherProject = (await prisma.project.create({ data: { organizationId: fixture.ctx!.organizationId, title: 'Otro' } })).id;
    const other = await image({ projectId: otherProject });
    for (const foreign of [otherZone, other]) await expect(callAction(removeStudioImages({ projectId }, [own.id, foreign.id]))).rejects.toThrow(/Alguna imagen/);
    expect(await prisma.deliverable.count({ where: { id: { in: [own.id, otherZone.id, other.id] }, deletedAt: null } })).toBe(3);
  });
  it('no borra vídeos ni permite que otra organización consulte, restaure o renombre medios', async () => {
    const render = await image(), video = await image({ type: 'VIDEO', payload: { type: 'video', assetKey: 'videos/fixture.mp4' } });
    await expect(callAction(removeStudioImages({ projectId }, [video.id]))).rejects.toThrow(/Alguna imagen/);
    await callAction(removeStudioImages({ projectId }, [render.id]));
    fixture.ctx = { ...fixture.ctx!, organizationId: await makeOrg() };
    await expect(callAction(listStudioDeletedImages({ projectId }))).rejects.toThrow(/Proyecto o zona/);
    await expect(callAction(restoreStudioImages({ projectId }, [render.id]))).rejects.toThrow(/Proyecto o zona/);
    await expect(callAction(renameStudioVideo({ projectId }, video.id, 'Ajeno'))).rejects.toThrow(/Proyecto o zona/);
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: render.id } })).deletedAt).not.toBeNull();
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: video.id } })).payload).toEqual(video.payload);
  });
  it('valida límites y duplicados antes de tocar los medios; restaurar un medio activo falla', async () => {
    const row = await image();
    for (const ids of [[], [row.id, row.id], Array.from({ length: 201 }, (_, i) => `id-${i}`)])
      await expect(callAction(removeStudioImages({ projectId }, ids))).rejects.toThrow();
    await expect(callAction(restoreStudioImages({ projectId }, [row.id]))).rejects.toThrow(/Alguna imagen/);
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(1);
  });
  it('cambia solo el nombre de un vídeo, preservando aprobación, referencias, estado y archivo', async () => {
    const payload = { type: 'video', mode: 'construction-ai', status: 'accepted', assetKey: 'videos/fixture.mp4', approvalId: 'approval', sourceIds: ['reference'], settings: { resolution: '768P' } };
    const row = await image({ type: 'VIDEO', payload });
    await callAction(renameStudioVideo({ projectId }, row.id, '  Obra · versión final  '));
    const renamed = await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } });
    expect(renamed.payload).toEqual({ ...payload, title: 'Obra · versión final' }); expect(renamed.version).toBe(2);
    expect(readVideoTitle(renamed.payload)).toBe('Obra · versión final');
    await callAction(renameStudioVideo({ projectId }, row.id, ''));
    expect(readVideoTitle((await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } })).payload)).toBeNull();
  });
  it('rechaza nombres largos o de control, otro tipo de medio y otra zona', async () => {
    const video = await image({ type: 'VIDEO', zoneId, payload: { type: 'video' } }), render = await image();
    for (const title of ['x'.repeat(101), 'Nombre\npartido']) await expect(callAction(renameStudioVideo({ projectId, zoneId }, video.id, title))).rejects.toThrow();
    await expect(callAction(renameStudioVideo({ projectId }, video.id, 'Zona incorrecta'))).rejects.toThrow(/Vídeo no encontrado/);
    await expect(callAction(renameStudioVideo({ projectId }, render.id, 'Imagen'))).rejects.toThrow(/Vídeo no encontrado/);
  });
  it('bloquea nombres durante un envío H3 para no interrumpir la persistencia de la tarea del proveedor', async () => {
    for (const mode of ['construction-ai', 'walkthrough-ai']) for (const status of ['submitting', 'generating', 'unknown']) {
      const payload = { type: 'video', mode, status, taskId: 'task' };
      const row = await image({ type: 'VIDEO', payload });
      await expect(callAction(renameStudioVideo({ projectId }, row.id, 'Otro nombre'))).rejects.toThrow(/envío H3/);
      const unchanged = await prisma.deliverable.findUniqueOrThrow({ where: { id: row.id } });
      expect(unchanged.version).toBe(1); expect(unchanged.payload).toEqual(payload);
    }
  });
  it('recupera tareas de primera persona solo dentro del mismo proyecto, zona y organización', async () => {
    const row = await image({ type: 'VIDEO', zoneId, payload: { type: 'video', mode: 'walkthrough-ai', status: 'generating', taskId: 'task' } });
    expect((await readDesignVideoJob(fixture.ctx!, { projectId, zoneId }, row.id)).job).toMatchObject({ mode: 'walkthrough-ai', taskId: 'task' });
    await expect(readDesignVideoJob(fixture.ctx!, { projectId }, row.id)).rejects.toThrow('no encontrada');
    const foreign = { ...fixture.ctx!, organizationId: await makeOrg() };
    await expect(readDesignVideoJob(foreign, { projectId, zoneId }, row.id)).rejects.toThrow('no encontrada');
  });
});
