import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
import { persistDeliverables } from '@/server/agent/persistence/deliverable-repo';
import type { Deliverable } from '@/lib/contracts';

// Entregable de render mínimo para persistir.
function render(id: string): Deliverable {
  return {
    id,
    type: 'render3d',
    payload: { type: 'render3d', assetUrl: 'https://cdn/x.png' },
    legalSeal: 'sello',
    version: 1,
  };
}

describe('persistDeliverables — trazabilidad origen→diseño', () => {
  beforeEach(resetDb);

  it('vincula el sourceImageId al crear y lo deja null sin imagen de origen', async () => {
    const orgId = await makeOrg();
    const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
    const img = await prisma.sourceImage.create({
      data: { organizationId: orgId, projectId: project.id, key: 'k', mime: 'image/png' },
    });

    await persistDeliverables(project.id, [render('d-con-origen')], img.id);
    await persistDeliverables(project.id, [render('d-sin-origen')]);

    const conOrigen = await prisma.deliverable.findUnique({ where: { id: 'd-con-origen' } });
    const sinOrigen = await prisma.deliverable.findUnique({ where: { id: 'd-sin-origen' } });
    expect(conOrigen?.sourceImageId).toBe(img.id);
    expect(sinOrigen?.sourceImageId).toBeNull();
  });

  it('un re-upsert por reintento no pisa el vínculo existente', async () => {
    const orgId = await makeOrg();
    const project = await prisma.project.create({ data: { organizationId: orgId, title: 'P' } });
    const img = await prisma.sourceImage.create({
      data: { organizationId: orgId, projectId: project.id, key: 'k', mime: 'image/png' },
    });

    await persistDeliverables(project.id, [render('d')], img.id);
    // Reintento sin sourceImageId (update no toca el vínculo creado).
    await persistDeliverables(project.id, [render('d')]);

    const row = await prisma.deliverable.findUnique({ where: { id: 'd' } });
    expect(row?.sourceImageId).toBe(img.id);
  });
});
