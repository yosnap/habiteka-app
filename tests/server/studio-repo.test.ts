import { beforeEach, describe, expect, it } from 'vitest';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { prisma } from '@/server/db/prisma';
import { makeOrg, resetDb } from '../helpers/db';
import type { OrgContext } from '@/server/auth/org-context';

beforeEach(resetDb);
describe('persistencia del estudio por organización', () => {
  it('persiste correcciones y rechaza un guardado concurrente obsoleto', async () => {
    const organizationId = await makeOrg();
    const ctx: OrgContext = { organizationId, userId: 'test', role: 'owner' };
    const project = await prisma.project.create({ data: { organizationId, title: 'Revisión aislada' } });
    await saveStudio(ctx, project.id, { planImportRevision: 'uno' });
    await saveStudio(ctx, project.id, { planImportRevision: 'dos', detalles: 'Corrección guardada' }, { expectedImportRevision: 'uno' });
    await expect(saveStudio(ctx, project.id, { planImportRevision: 'tres' }, { expectedImportRevision: 'uno' })).rejects.toThrow(/revisión/);
    expect((await loadStudio(ctx, project.id)).detalles).toBe('Corrección guardada');
  });
  it('recupera el plano y la cenital al volver al proyecto', async () => {
    const organizationId = await makeOrg();
    const ctx: OrgContext = { organizationId, userId: 'test', role: 'owner' };
    const project = await prisma.project.create({ data: { organizationId, title: 'Estudio' } });
    const state = {
      plan: { assetUrl: 'data:image/png;base64,YQ==' },
      cenital: { assetUrl: 'data:image/png;base64,Yg==' },
      detalles: 'Cocina con isla',
      estilo: 'moderno' as const,
    };
    await saveStudio(ctx, project.id, state);
    expect(await loadStudio(ctx, project.id)).toEqual(state);
  });

  it('rechaza lectura y escritura de proyectos ajenos o borrados', async () => {
    const organizationId = await makeOrg();
    const project = await prisma.project.create({ data: { organizationId, title: 'Privado' } });
    const other: OrgContext = { organizationId: await makeOrg(), userId: 'test', role: 'owner' };
    await expect(loadStudio(other, project.id)).rejects.toThrow('Proyecto no encontrado');
    await expect(saveStudio(other, project.id, {})).rejects.toThrow('Proyecto no encontrado');
    await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
    await expect(loadStudio({ ...other, organizationId }, project.id)).rejects.toThrow(
      'Proyecto no encontrado',
    );
  });

  it('persiste el historial sin enlaces firmados que caducan', async () => {
    const organizationId = await makeOrg();
    const ctx: OrgContext = { organizationId, userId: 'test', role: 'owner' };
    const project = await prisma.project.create({ data: { organizationId, title: 'Historial' } });
    await saveStudio(ctx, project.id, {
      results: [
        { id: 'origen', kind: 'source', assetKey: 'origen', createdAt: '2026-09-24T12:00:00.000Z' },
        { id: 'render', kind: 'render', assetKey: 'render', sourceKey: 'origen', vista: 'cenital', createdAt: '2026-09-24T12:01:00.000Z' },
      ],
    });
    const restored = await loadStudio(ctx, project.id);
    expect(restored.results?.map((item) => item.assetKey)).toEqual(['origen', 'render']);
    expect(JSON.stringify(restored.results)).not.toContain('assetUrl');
  });
});
