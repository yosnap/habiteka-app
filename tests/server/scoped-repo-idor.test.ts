import { describe, it, expect, beforeEach } from 'vitest';
import { withOrg } from '@/server/db/scoped-repo';
import { makeOrg, resetDb } from '../helpers/db';
import type { OrgContext } from '@/server/auth/org-context';

function ctx(organizationId: string): OrgContext {
  return { organizationId, userId: 'u1', role: 'owner' };
}

describe('Scoping estructural por organización (anti-IDOR)', () => {
  beforeEach(resetDb);

  it('list solo devuelve recursos de la organización del contexto', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await withOrg(ctx(orgA)).projects.create({ title: 'A' });
    await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    const listA = await withOrg(ctx(orgA)).projects.list();
    expect(listA).toHaveLength(1);
    expect(listA[0]?.title).toBe('A');
  });

  it('findById de un recurso de otra org devuelve null (no fuga por id)', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    // orgA conoce el id de orgB pero el scoping impide leerlo.
    const leaked = await withOrg(ctx(orgA)).projects.findById(projB.id);
    expect(leaked).toBeNull();
  });

  it('delete no borra recursos de otra org', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    await withOrg(ctx(orgA)).projects.delete(projB.id); // no debe afectar a B
    expect(await withOrg(ctx(orgB)).projects.findById(projB.id)).not.toBeNull();
  });
});
