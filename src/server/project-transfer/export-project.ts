import 'server-only';
import { zipSync, strToU8 } from 'fflate';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import {
  collectStorageKeys, PROJECT_TRANSFER_FORMAT, PROJECT_TRANSFER_VERSION, type ProjectTransferManifest,
} from '@/lib/project-transfer/manifest';
import packageJson from '../../../package.json';

const iso = (date: Date) => date.toISOString();

/** Reúne el proyecto de la organización con sus zonas, editor, entregables e imágenes, sin los borrados. */
export async function collectProject(ctx: OrgContext, projectId: string): Promise<ProjectTransferManifest> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: ctx.organizationId, deletedAt: null },
    include: {
      zones: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
      canvasStates: true,
      sourceImages: { where: { deletedAt: null } },
      deliverables: { where: { deletedAt: null }, include: { iterations: true } },
      editorDocuments: { include: { revisions: { orderBy: { revision: 'asc' } }, approvals: true } },
    },
  });
  if (!project) throw new Error('Proyecto no encontrado en tu organización.');
  const base = {
    format: PROJECT_TRANSFER_FORMAT, version: PROJECT_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(), appVersion: packageJson.version,
    source: { organizationId: ctx.organizationId, projectId: project.id },
    project: { id: project.id, title: project.title, studioState: project.studioState ?? null },
    zones: project.zones.map((zone) => ({ id: zone.id, name: zone.name, kind: zone.kind, order: zone.order })),
    canvasStates: project.canvasStates.map((row) => ({ id: row.id, zoneId: row.zoneId, data: row.data, version: row.version })),
    sourceImages: project.sourceImages.map((row) => ({
      id: row.id, zoneId: row.zoneId, key: row.key, mime: row.mime, width: row.width, height: row.height,
      role: row.role, faceBlurred: row.faceBlurred, createdAt: iso(row.createdAt),
    })),
    deliverables: project.deliverables.map((row) => ({
      id: row.id, zoneId: row.zoneId, sourceImageId: row.sourceImageId, type: row.type, payload: row.payload,
      legalSeal: row.legalSeal, version: row.version, createdAt: iso(row.createdAt),
    })),
    iterations: project.deliverables.flatMap((row) => row.iterations.map((item) => ({
      id: item.id, deliverableId: item.deliverableId, zone: item.zone, instruction: item.instruction,
      resultRef: item.resultRef, createdAt: iso(item.createdAt),
    }))),
    editorStates: project.editorDocuments.map((state) => ({
      id: state.id, zoneId: state.zoneId, headRevision: state.headRevision, writable: state.writable,
      legacySnapshot: state.legacySnapshot, legacyFingerprint: state.legacyFingerprint,
      revisions: state.revisions.map((row) => ({ id: row.id, revision: row.revision, document: row.document,
        requestKey: row.requestKey, fingerprint: row.fingerprint, createdAt: iso(row.createdAt) })),
      approvals: state.approvals.map((row) => ({ id: row.id, revisionId: row.revisionId, fingerprint: row.fingerprint,
        assets: row.assets, lightingPreset: row.lightingPreset, approvedAt: iso(row.approvedAt) })),
    })),
  } satisfies Omit<ProjectTransferManifest, 'assets'>;
  return { ...base, assets: collectStorageKeys(base) };
}

/**
 * Empaqueta el proyecto en un ZIP (`.habiteka`). Un archivo referenciado que ya no
 * existe en el almacenamiento se omite: el proyecto importado lo verá como ausente,
 * igual que aquí.
 */
export async function exportProjectArchive(ctx: OrgContext, projectId: string): Promise<{ title: string; archive: Uint8Array }> {
  const manifest = await collectProject(ctx, projectId);
  const storage = getStorageAdapter();
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const present: string[] = [];
  for (const key of manifest.assets) {
    try {
      // Imágenes y vídeos ya vienen comprimidos: se guardan sin volver a comprimir.
      files[`assets/${key}`] = [new Uint8Array(await storage.get(key)), { level: 0 }];
      present.push(key);
    } catch { /* Archivo borrado del almacenamiento: no se exporta. */ }
  }
  files['manifest.json'] = strToU8(JSON.stringify({ ...manifest, assets: present }));
  return { title: manifest.project.title, archive: zipSync(files) };
}
