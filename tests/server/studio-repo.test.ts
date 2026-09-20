import { beforeEach, describe, expect, it } from 'vitest';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { prisma } from '@/server/db/prisma';
import { makeOrg, resetDb } from '../helpers/db';
import type { OrgContext } from '@/server/auth/org-context';

beforeEach(resetDb);
describe('persistencia del estudio por organización', () => {
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
});
