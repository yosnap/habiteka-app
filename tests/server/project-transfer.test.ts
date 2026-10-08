/**
 * Exportar un proyecto a `.habiteka` e importarlo en otra organización: mismas
 * filas, documentos y archivos, con ids y keys nuevas y sin referencias al origen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';

const files = vi.hoisted(() => new Map<string, Buffer>());

vi.mock('server-only', () => ({}));
vi.mock('@/server/storage/s3-storage-adapter', () => ({
  getStorageAdapter: () => ({
    put: async ({ key, body }: { key: string; body: Buffer }) => { files.set(key, body); },
    get: async (key: string) => { const data = files.get(key); if (!data) throw new Error('Activo no encontrado'); return data; },
    delete: async (key: string) => { files.delete(key); },
    getPresignedDownloadUrl: async (key: string) => `https://storage.local/${key}?signed=1`,
  }),
}));

import { prisma } from '@/server/db/prisma';
import { exportProjectArchive } from '@/server/project-transfer/export-project';
import { importProjectArchive, readProjectArchive } from '@/server/project-transfer/import-project';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

let from: OrgContext, to: OrgContext;

beforeEach(async () => {
  await resetDb();
  files.clear();
  from = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' };
  to = { organizationId: await makeOrg(), userId: (await makeUser()).id, role: 'owner' };
});

async function seedProject() {
  const project = await prisma.project.create({ data: { organizationId: from.organizationId, title: 'Casa de prueba' } });
  const zone = await prisma.projectZone.create({ data: { organizationId: from.organizationId, projectId: project.id, name: 'Planta baja' } });
  const studioKey = 'studio/plano.png';
  const siteKey = `geographic-sites/${from.organizationId}/${project.id}/sitio.png`;
  files.set(studioKey, Buffer.from('plano'));
  files.set(siteKey, Buffer.from('sitio'));
  files.set('renders/kie/cenital.png', Buffer.from('cenital'));
  await prisma.project.update({ where: { id: project.id }, data: { studioState: {
    source: { assetKey: studioKey, assetUrl: 'http://local/expirada' }, site: { assetKey: siteKey } } } });
  const cenital = await prisma.deliverable.create({ data: { id: `del-${project.id}-render3d-1`, projectId: project.id, zoneId: zone.id,
    type: 'RENDER_3D', legalSeal: 'sello', payload: { type: 'render3d', assetKey: 'renders/kie/cenital.png', assetUrl: 'http://local/x' } } });
  const state = await prisma.editorDocumentState.create({ data: { projectId: project.id, legacySnapshot: {}, legacyFingerprint: 'f', headRevision: 1 } });
  const revision = await prisma.editorDocumentRevision.create({ data: { stateId: state.id, revision: 1, fingerprint: 'r1',
    document: { schemaVersion: 7, renderBackdrop: { deliverableId: cenital.id } } } });
  const approval = await prisma.editorDesignApproval.create({ data: { stateId: state.id, revisionId: revision.id, fingerprint: 'a1',
    assets: { cenital: cenital.id }, approvedById: from.userId } });
  // Un vídeo enlaza la aprobación y el diseño por id dentro de su payload.
  await prisma.deliverable.create({ data: { projectId: project.id, type: 'VIDEO', legalSeal: 'sello',
    payload: { type: 'video', approvalId: approval.id, sourceDeliverableIds: [cenital.id] } } });
  return { project, approval, cenital };
}

describe('exportar e importar un proyecto', () => {
  it('lleva filas, documentos y archivos a otra organización con ids y keys nuevas', async () => {
    const { project } = await seedProject();
    const { archive } = await exportProjectArchive(from, project.id);
    expect(readProjectArchive(archive).manifest.assets).toHaveLength(3);

    const { projectId } = await importProjectArchive(to, archive);
    expect(projectId).not.toBe(project.id);
    const copy = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: {
      zones: true, deliverables: true, editorDocuments: { include: { revisions: true, approvals: true } } } });
    expect(copy.organizationId).toBe(to.organizationId);
    expect(copy.title).toBe('Casa de prueba');
    expect(copy.zones).toHaveLength(1);
    expect(copy.deliverables).toHaveLength(2);
    const [state] = copy.editorDocuments;
    expect(state!.revisions).toHaveLength(1);
    expect(state!.approvals[0]!.approvedById).toBe(to.userId);

    // Ninguna referencia al proyecto ni a la organización de origen.
    const serialized = JSON.stringify(copy);
    expect(serialized).not.toContain(project.id);
    expect(serialized).not.toContain(from.organizationId);

    // Las referencias internas apuntan a las filas nuevas.
    const cenital = copy.deliverables.find((row) => (row.payload as { type: string }).type === 'render3d')!;
    const video = copy.deliverables.find((row) => (row.payload as { type: string }).type === 'video')!;
    expect(video.payload).toMatchObject({ approvalId: state!.approvals[0]!.id, sourceDeliverableIds: [cenital.id] });
    expect(state!.revisions[0]!.document).toMatchObject({ renderBackdrop: { deliverableId: cenital.id } });
    expect(cenital.zoneId).toBe(copy.zones[0]!.id);

    // Archivos copiados con keys nuevas; la del sitio conserva su prefijo de propiedad.
    const studio = copy.studioState as { source: { assetKey: string; assetUrl: string }; site: { assetKey: string } };
    expect(studio.source.assetKey).toBe(`imports/${projectId}/studio/plano.png`);
    expect(studio.source.assetUrl).toContain(studio.source.assetKey);
    expect(studio.site.assetKey).toBe(`geographic-sites/${to.organizationId}/${projectId}/sitio.png`);
    expect(files.get(studio.site.assetKey)?.toString()).toBe('sitio');
    expect(files.get((cenital.payload as { assetKey: string }).assetKey)?.toString()).toBe('cenital');
  });

  it('no exporta un proyecto de otra organización', async () => {
    const { project } = await seedProject();
    await expect(exportProjectArchive(to, project.id)).rejects.toThrow(/no encontrado/);
  });

  it('rechaza un archivo que no es un proyecto y no deja archivos copiados', async () => {
    await expect(importProjectArchive(to, new Uint8Array([1, 2, 3]))).rejects.toThrow(/no es un proyecto/);
    expect(files.size).toBe(0);
  });
});
