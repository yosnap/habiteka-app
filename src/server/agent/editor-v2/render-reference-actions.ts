'use server';
import { z } from 'zod';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { renderViewSchema } from '@/lib/editor-document/render-view';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { referenceSettingIssues, requiredReferencePreset } from '@/lib/editor-document/render-reference-compatibility';
import { sameContentRevisions, sameVisualDesignContent } from '@/server/walkthrough/tour-images';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import type { Deliverable } from '@/lib/contracts';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';

/** Consulta gratuita; no genera, audita ni acepta imágenes. Incluye pendientes para poder revisarlas. */
export async function listRenderReferences(scope: EditorScope, rawDocument: unknown, rawView: unknown, rawOptions: unknown, rawCursor?: string) {
  const ctx = await requireOrgContext();
  const target = await prisma.$transaction(tx => assertEditorScope(tx, ctx, scope));
  const document = parseEditorDocument(rawDocument), view = renderViewSchema.parse(rawView), options = renderDesignOptionsSchema.parse(rawOptions);
  const preset = requiredReferencePreset(view, options), cursor = z.string().min(1).max(128).optional().parse(rawCursor);
  if (!preset) return { items: [], nextCursor: null };
  const rows = await prisma.deliverable.findMany({ where: { ...target, type: 'RENDER_3D', deletedAt: null,
    project: { organizationId: ctx.organizationId, deletedAt: null }, payload: { path: ['generation', 'view', 'preset'], equals: preset } },
    select: { id: true, payload: true, version: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 41,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const page = rows.slice(0, 40);
  const revisions = page.map(row => (row.payload as unknown as Extract<Deliverable['payload'], { type: 'render3d' }>).generation?.documentRevision ?? 0);
  const valid = new Set(await sameContentRevisions(ctx, target, { document, revision: document.revision }, revisions));
  // Un borrador sin guardar no puede declararse compatible solo por conservar el número de revisión.
  const stored = await withEditorDocuments(ctx).readRevision(target, document.revision);
  if (!sameVisualDesignContent(stored, document)) valid.delete(document.revision);
  const items = await Promise.all(page.map(async row => {
    const payload = row.payload as unknown as Extract<Deliverable['payload'], { type: 'render3d' }>;
    const issues = referenceSettingIssues(payload.generation, view, options);
    if (!valid.has(payload.generation?.documentRevision ?? 0)) issues.push('El plano actual es diferente del que originó esta imagen.');
    const url = await resolveRenderUrl(payload);
    if (!url) issues.push('El archivo de imagen no está disponible.');
    return { item: { id: row.id, version: row.version, type: 'render3d' as const, legalSeal: DELIVERABLE_LEGAL_SEAL,
      payload: { ...payload, type: 'render3d' as const, assetUrl: url ?? '' }, zoneId: target.zoneId, sourceImageUrl: null },
      issues, createdAt: row.createdAt.toISOString() };
  }));
  return { items, nextCursor: rows.length > 40 ? page.at(-1)!.id : null };
}
