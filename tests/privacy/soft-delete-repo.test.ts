import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
import { withOrg } from '@/server/db/scoped-repo';
import type { OrgContext } from '@/server/auth/org-context';
import { exportOrganizationData } from '@/server/privacy/data-export';

// Contexto de organización para el repo (rol owner, usuario ficticio).
function ctx(organizationId: string): OrgContext {
  return { organizationId, userId: `u-${organizationId}`, role: 'owner' };
}

beforeEach(async () => {
  await resetDb();
});

describe('soft-delete en el repo scoped', () => {
  it('delete() marca deletedAt (no borra la fila) y desaparece de list/findById', async () => {
    const organizationId = await makeOrg();
    const repo = withOrg(ctx(organizationId));
    const project = await repo.projects.create({ title: 'P' });

    await repo.projects.delete(project.id);

    // La fila sigue en DB, pero soft-deleted.
    const row = await prisma.project.findUnique({ where: { id: project.id } });
    expect(row?.deletedAt).not.toBeNull();

    // Las vistas normales no la muestran.
    expect(await repo.projects.list()).toHaveLength(0);
    expect(await repo.projects.findById(project.id)).toBeNull();
  });

  it('un proyecto soft-deleted no expone su canvas', async () => {
    const organizationId = await makeOrg();
    const repo = withOrg(ctx(organizationId));
    const project = await repo.projects.create({ title: 'P' });
    await repo.canvas.save(project.id, { shapes: [] });
    await repo.projects.delete(project.id);

    expect(await repo.canvas.load(project.id)).toBeNull();
  });
});

describe('data-export (portabilidad art. 20)', () => {
  it('exporta proyectos vivos de la org y nada de otra org', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const repoA = withOrg(ctx(orgA));
    await repoA.projects.create({ title: 'mío' });
    await withOrg(ctx(orgB)).projects.create({ title: 'ajeno' });

    const dump = await exportOrganizationData(orgA, new Date('2026-06-20T00:00:00Z'));
    expect(dump.organizationId).toBe(orgA);
    expect(dump.projects).toHaveLength(1);
    expect((dump.projects[0] as { title: string }).title).toBe('mío');
  });
});
