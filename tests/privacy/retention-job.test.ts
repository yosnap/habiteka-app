import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
import { purgeExpiredSoftDeletes } from '@/server/privacy/retention-job';
import type { StorageAdapter } from '@/server/storage/storage-adapter';

function fakeStorage(): StorageAdapter & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async put() {},
    async delete(key: string) {
      deleted.push(key);
    },
    async get() {
      return Buffer.alloc(0);
    },
    async getPresignedUploadUrl() {
      return 'x';
    },
    async getPresignedDownloadUrl() {
      return 'x';
    },
  };
}

beforeEach(async () => {
  await resetDb();
});

describe('purgeExpiredSoftDeletes (retención por TTL)', () => {
  it('hard-borra los proyectos soft-deleted vencidos y conserva los vigentes', async () => {
    const orgId = await makeOrg();
    const now = new Date('2026-06-20T00:00:00Z');

    // Soft-deleted hace 40 días (vencido con TTL de 30).
    const expired = await prisma.project.create({
      data: { organizationId: orgId, title: 'viejo', deletedAt: new Date('2026-05-11T00:00:00Z') },
    });
    // Soft-deleted hace 5 días (aún en papelera).
    const fresh = await prisma.project.create({
      data: {
        organizationId: orgId,
        title: 'reciente',
        deletedAt: new Date('2026-06-15T00:00:00Z'),
      },
    });
    // Vivo (no borrado).
    const alive = await prisma.project.create({
      data: { organizationId: orgId, title: 'vivo' },
    });

    const result = await purgeExpiredSoftDeletes(fakeStorage(), { now });

    expect(result.projectsPurged).toBe(1);
    expect(await prisma.project.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.project.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    expect(await prisma.project.findUnique({ where: { id: alive.id } })).not.toBeNull();
  });

  it('borra los objetos de storage de un proyecto vencido', async () => {
    const orgId = await makeOrg();
    const project = await prisma.project.create({
      data: { organizationId: orgId, title: 'p', deletedAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.deliverable.create({
      data: {
        projectId: project.id,
        type: 'RENDER_3D',
        payload: { type: 'render3d', assetUrl: 'https://cdn.example.com/r/z.png' },
        legalSeal: 's',
      },
    });

    const storage = fakeStorage();
    await purgeExpiredSoftDeletes(storage, { now: new Date('2026-06-20T00:00:00Z') });

    expect(storage.deleted).toContain('r/z.png');
  });
});
