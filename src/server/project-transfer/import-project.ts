import 'server-only';
import { strFromU8, unzipSync } from 'fflate';
import type { Prisma } from '@/generated/prisma/client';
import type { DeliverableType, SourceImageRole } from '@/generated/prisma/enums';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { assertTransferManifest, type ProjectTransferManifest } from '@/lib/project-transfer/manifest';
import { refreshAssetUrls, remapManifest } from '@/lib/project-transfer/remap';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', json: 'application/json', glb: 'model/gltf-binary',
};
const contentType = (key: string) => CONTENT_TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
const json = (value: unknown) => value as Prisma.InputJsonValue;
const newId = () => `c${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

/** Lee y valida el manifiesto y los archivos de un `.habiteka`. */
export function readProjectArchive(archive: Uint8Array): { manifest: ProjectTransferManifest; files: Record<string, Uint8Array> } {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(archive); } catch { throw new Error('El archivo no es un proyecto de Habiteka válido.'); }
  const raw = files['manifest.json'];
  if (!raw) throw new Error('El archivo no es un proyecto de Habiteka.');
  let manifest: unknown;
  try { manifest = JSON.parse(strFromU8(raw)); } catch { throw new Error('El índice del proyecto está dañado.'); }
  assertTransferManifest(manifest);
  return { manifest, files };
}

/**
 * Crea en la organización de quien importa un proyecto nuevo idéntico al exportado:
 * ids y keys nuevas, archivos copiados al almacenamiento y aprobaciones a su nombre.
 * Si la base de datos falla, se retiran los archivos ya copiados.
 */
export async function importProjectArchive(ctx: OrgContext, archive: Uint8Array): Promise<{ projectId: string; title: string }> {
  const { manifest: source, files } = readProjectArchive(archive);
  const { manifest, keys } = remapManifest(source, { organizationId: ctx.organizationId, projectId: newId(), newId });
  const storage = getStorageAdapter();
  const copied: string[] = [];
  try {
    for (const [from, to] of keys) {
      const body = files[`assets/${from}`];
      if (!body) continue;
      await storage.put({ key: to, body: Buffer.from(body), contentType: contentType(to) });
      copied.push(to);
    }
    const sign = (key: string) => storage.getPresignedDownloadUrl(key);
    const fresh = async <T>(value: T) => (await refreshAssetUrls(value, sign)) as T;
    const project = manifest.project;
    const deliverables = await Promise.all(manifest.deliverables.map(async (row) => ({ ...row, payload: await fresh(row.payload) })));
    const studioState = await fresh(project.studioState);
    await prisma.$transaction(async (tx) => {
      await tx.project.create({ data: { id: project.id, organizationId: ctx.organizationId, title: project.title,
        ...(studioState !== null ? { studioState: json(studioState) } : {}) } });
      for (const zone of manifest.zones)
        await tx.projectZone.create({ data: { ...zone, organizationId: ctx.organizationId, projectId: project.id } });
      for (const row of manifest.canvasStates)
        await tx.canvasState.create({ data: { id: row.id, projectId: project.id, zoneId: row.zoneId, data: json(row.data), version: row.version } });
      for (const row of manifest.sourceImages)
        await tx.sourceImage.create({ data: { ...row, role: row.role as SourceImageRole, createdAt: new Date(row.createdAt),
          organizationId: ctx.organizationId, projectId: project.id } });
      for (const row of deliverables)
        await tx.deliverable.create({ data: { id: row.id, projectId: project.id, zoneId: row.zoneId, sourceImageId: row.sourceImageId,
          type: row.type as DeliverableType, payload: json(row.payload), legalSeal: row.legalSeal, version: row.version,
          createdAt: new Date(row.createdAt) } });
      for (const row of manifest.iterations)
        await tx.iteration.create({ data: { ...row, zone: json(row.zone), createdAt: new Date(row.createdAt) } });
      for (const state of manifest.editorStates) {
        await tx.editorDocumentState.create({ data: { id: state.id, projectId: project.id, zoneId: state.zoneId,
          headRevision: state.headRevision, writable: state.writable, legacySnapshot: json(state.legacySnapshot),
          legacyFingerprint: state.legacyFingerprint } });
        await tx.editorDocumentRevision.createMany({ data: state.revisions.map((row) => ({ ...row, stateId: state.id,
          document: json(row.document), createdAt: new Date(row.createdAt) })) });
        for (const row of state.approvals)
          await tx.editorDesignApproval.create({ data: { ...row, stateId: state.id, assets: json(await fresh(row.assets)),
            approvedById: ctx.userId, approvedAt: new Date(row.approvedAt) } });
      }
    }, { timeout: 120_000 });
    return { projectId: project.id, title: project.title };
  } catch (error) {
    await Promise.allSettled(copied.map((key) => storage.delete(key)));
    throw error;
  }
}
