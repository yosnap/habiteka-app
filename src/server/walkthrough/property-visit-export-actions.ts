'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { readPropertyVisit, updatePropertyVisit } from './property-visit-repo';
import { propertyVisitAcceptedFrames } from './property-visit-sources';
import { signUploadTicket, readUploadTicket } from './upload-ticket';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { revalidatePath } from 'next/cache';
import type { PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import { propertyVisitDurationIssue } from '@/lib/editor-document/property-visit-budget';

function secret() { const value = process.env.BETTER_AUTH_SECRET; if (!value) throw new Error('Falta la firma de subidas.'); return value; }
function reviewed(job: PropertyVisitJob) {
  const issue = propertyVisitDurationIssue(job); if (issue) throw new Error(issue);
  if (!job.plan.complete || !job.segments.length || job.segments.some(segment => segment.state !== 'accepted' || !segment.assetKey || !segment.reviewedBy))
    throw new Error('Revisa todos los tramos y sus uniones antes de exportar el paseo completo.');
}
async function validateSources(ctx: Awaited<ReturnType<typeof requireOrgContext>>, scope: EditorScope, id: string, job: PropertyVisitJob) {
  reviewed(job);
  const frames = await propertyVisitAcceptedFrames(ctx, scope, id, job);
  if (job.segments.some(segment => !segment.sourceVersions?.length ||
    segment.sourceVersions.some(source => !frames.some(frame => frame.id === source.id && frame.version === source.version))))
    throw new Error('Una referencia cambió después de generar los tramos. El paseo necesita una nueva revisión.');
}
export async function propertyVisitExportSources(rawScope: EditorScope, id: string) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  await validateSources(ctx, scope, id, row.job);
  return { version: row.version, clips: row.job.segments.map(segment => ({ seconds: segment.seconds, url: '' })) };
}
/** Firma cada descarga al necesitarla, para que un paseo largo no agote la caducidad de sus últimos clips. */
export async function propertyVisitExportClip(rawScope: EditorScope, id: string, index: number, version: number) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  reviewed(row.job);
  if (row.version !== version || !Number.isSafeInteger(index) || index < 0 || index >= row.job.segments.length)
    throw new Error('El paseo cambió durante la composición. Vuelve a componer sus tramos revisados.');
  return getStorageAdapter().getPresignedDownloadUrl(row.job.segments[index]!.assetKey!);
}
export async function preparePropertyVisitUpload(rawScope: EditorScope, id: string, bytes: number, durationMs: number, version: number) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  await validateSources(ctx, scope, id, row.job);
  if (row.version !== version) throw new Error('El paseo cambió durante la composición. Vuelve a componer sus tramos revisados.');
  if (!Number.isSafeInteger(bytes) || bytes < 32 || bytes > 1024 ** 3 || durationMs !== row.job.durationMs)
    throw new Error('El archivo no coincide con la duración del paseo o supera 1 GB.');
  const key = `walkthrough-uploads/${ctx.organizationId}/${scope.projectId}/${crypto.randomUUID()}.mp4`;
  const ticket = signUploadTicket({ id, key, organizationId: ctx.organizationId, userId: ctx.userId, projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, routeId: id, approvalId: row.job.approvalId, approvedRevision: row.job.approvedRevision,
    approvedFingerprint: row.job.approvedFingerprint, bytes, durationMs, mode: 'property-visit-ai', jobVersion: row.version,
    expires: Date.now() + 30 * 60 * 1000 }, secret());
  return { ticket, url: await getStorageAdapter().getPresignedUploadUrl(key, bytes, 'video/mp4') };
}
export async function finishPropertyVisitUpload(token: string) {
  const ctx = await requireOrgContext(), ticket = readUploadTicket(token, secret());
  if (ticket.mode !== 'property-visit-ai' || ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.userId)
    throw new Error('Permiso de subida no válido para este paseo.');
  const scope = { projectId: ticket.projectId, zoneId: ticket.zoneId }, row = await readPropertyVisit(ctx, scope, ticket.id);
  if (row.version !== ticket.jobVersion || row.job.approvedFingerprint !== ticket.approvedFingerprint)
    throw new Error('El paseo cambió durante la exportación; vuelve a comprobar sus referencias.');
  await validateSources(ctx, scope, ticket.id, row.job);
  const storage = getStorageAdapter();
  if (!storage.inspect || !storage.promote) throw new Error('El almacenamiento no admite verificación de vídeos.');
  const assetKey = `videos/${ctx.organizationId}/${scope.projectId}/${ticket.id}/complete-${ticket.jobVersion}.mp4`;
  let promoted = false;
  const info = await storage.inspect(ticket.key).catch(async () => { const result = await storage.inspect!(assetKey); promoted = true; return result; });
  if (info.bytes !== ticket.bytes || info.bytes < 32 || info.bytes > 1024 ** 3 || info.contentType !== 'video/mp4' ||
    Buffer.from(info.header).subarray(4, 8).toString() !== 'ftyp') throw new Error('El archivo subido no es el MP4 esperado.');
  if (!promoted) await storage.promote(ticket.key, assetKey);
  await updatePropertyVisit(ctx, scope, ticket.id, row.version, { ...row.job, assetKey });
  revalidatePath(`/projects/${scope.projectId}/videos`);
}
export async function reviewPropertyVisitFinal(rawScope: EditorScope, id: string, confirmed: boolean) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  if (confirmed !== true || !row.job.assetKey) throw new Error('Reproduce y revisa el paseo completo antes de aceptarlo.');
  await validateSources(ctx, scope, id, row.job);
  await updatePropertyVisit(ctx, scope, id, row.version, { ...row.job, finalReviewedAt: new Date().toISOString(), finalReviewedBy: ctx.userId });
}
