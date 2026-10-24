import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import { requireRole } from '@/server/auth/permissions';
import { documentFingerprint, readDocumentInput } from './document-input';
import { assertGeographicSiteOwnership } from './geographic-site-ownership';

/** Crea proyecto y primera revisión juntos; nunca sustituye un plano existente. */
export async function createPreviewProject(ctx: OrgContext, input: { title: string; document: unknown; requestKey: string }) {
  requireRole(ctx, 'member');
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120)
    throw new Error('Escribe un nombre de entre 1 y 120 caracteres.');
  if (typeof input.requestKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.requestKey))
    throw new Error('Petición de guardado inválida.');
  const document = readDocumentInput(input.document);
  document.revision = 0;
  const id = `preview-${input.requestKey}`;
  assertGeographicSiteOwnership(document, ctx, id);
  const fingerprint = documentFingerprint(document);
  return prisma.$transaction(async (tx) => {
    // Serializa reintentos simultáneos de la misma petición sin crear duplicados.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const existing = await tx.project.findUnique({ where: { id }, select: { organizationId: true, deletedAt: true } });
    if (existing) {
      if (existing.organizationId !== ctx.organizationId || existing.deletedAt) throw new Error('Petición de guardado no disponible.');
      const state = await tx.editorDocumentState.findFirst({ where: { projectId: id, zoneId: null } });
      const first = state && await tx.editorDocumentRevision.findUnique({ where: { stateId_revision: { stateId: state.id, revision: 0 } } });
      if (first?.fingerprint !== fingerprint) throw new Error('El contenido de esta petición ha cambiado. Vuelve a guardar.');
      return { id };
    }
    await tx.project.create({ data: { id, title: input.title.trim(), organizationId: ctx.organizationId } });
    const state = await tx.editorDocumentState.create({ data: {
      projectId: id, zoneId: null, legacySnapshot: Prisma.JsonNull, legacyFingerprint: documentFingerprint(null),
    } });
    await tx.editorDocumentRevision.create({ data: {
      stateId: state.id, revision: 0, document: document as unknown as Prisma.InputJsonValue, fingerprint,
    } });
    return { id };
  });
}
