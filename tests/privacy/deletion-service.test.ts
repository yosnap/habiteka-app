import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';
import { eraseOrganizationData } from '@/server/privacy/deletion-service';
import type { StorageAdapter } from '@/server/storage/storage-adapter';

// Storage falso que registra las claves borradas.
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

// Siembra un proyecto con conversación, mensaje, entregable render e iteración.
async function seedProject(organizationId: string) {
  const project = await prisma.project.create({
    data: { organizationId, title: 'P' },
  });
  const conv = await prisma.conversation.create({ data: { projectId: project.id } });
  await prisma.message.create({
    data: { conversationId: conv.id, role: 'user', content: { text: 'hola' } },
  });
  const deliverable = await prisma.deliverable.create({
    data: {
      projectId: project.id,
      type: 'RENDER_3D',
      payload: { type: 'render3d', assetUrl: 'https://cdn.example.com/renders/x.png' },
      legalSeal: 'sello',
    },
  });
  await prisma.iteration.create({
    data: {
      deliverableId: deliverable.id,
      zone: { x: 0 },
      instruction: 'i',
      resultRef: 'iterations/y.png',
    },
  });
  // Imagen de origen subida por el usuario (dato personal con binario en storage).
  await prisma.sourceImage.create({
    data: {
      organizationId,
      projectId: project.id,
      key: 'source-images/org/z.png',
      mime: 'image/png',
    },
  });
  return project;
}

beforeEach(async () => {
  await resetDb();
});

describe('eraseOrganizationData (RGPD art. 17)', () => {
  it('borra de verdad todo el contenido propio sin dejar huérfanos', async () => {
    const orgId = await makeOrg();
    await seedProject(orgId);

    const storage = fakeStorage();
    const report = await eraseOrganizationData(storage, orgId);

    expect(report.projectsDeleted).toBe(1);
    expect(report.deliverablesDeleted).toBe(1);
    // Borró los objetos de storage: render, iteración e imagen de origen.
    expect(storage.deleted).toEqual(
      expect.arrayContaining(['renders/x.png', 'iterations/y.png', 'source-images/org/z.png']),
    );

    // Sin filas de imagen de origen tras el borrado (cascade desde Project).
    expect(await prisma.sourceImage.count({ where: { organizationId: orgId } })).toBe(0);

    // Cero filas en DB para esa organización (cascade completo). Se filtra por la
    // org borrada en vez de contar el total: la BD de dev conserva el admin (con
    // sus propios proyectos/entregables), que no debe contaminar la aserción.
    expect(await prisma.project.count({ where: { organizationId: orgId } })).toBe(0);
    expect(
      await prisma.conversation.count({ where: { project: { organizationId: orgId } } }),
    ).toBe(0);
    expect(
      await prisma.message.count({
        where: { conversation: { project: { organizationId: orgId } } },
      }),
    ).toBe(0);
    expect(
      await prisma.deliverable.count({ where: { project: { organizationId: orgId } } }),
    ).toBe(0);
    expect(
      await prisma.iteration.count({
        where: { deliverable: { project: { organizationId: orgId } } },
      }),
    ).toBe(0);
  });

  it('no toca el contenido de otra organización', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await seedProject(orgA);
    await seedProject(orgB);

    await eraseOrganizationData(fakeStorage(), orgA);

    expect(await prisma.project.count({ where: { organizationId: orgA } })).toBe(0);
    expect(await prisma.project.count({ where: { organizationId: orgB } })).toBe(1);
  });
});
