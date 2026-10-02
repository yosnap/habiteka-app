import type { EditorDocument } from '@/lib/editor-document/schema';
import type { OrgContext } from '@/server/auth/org-context';

export function assertGeographicSiteOwnership(doc: EditorDocument, ctx: OrgContext, projectId: string) {
  const site = doc.geographicSite;
  if (site && !site.assetKey.startsWith(`geographic-sites/${ctx.organizationId}/${projectId}/`))
    throw new Error('La ortofoto no pertenece a este proyecto.');
  if (doc.levels?.some(level => level.document?.geographicSite))
    throw new Error('La ubicación debe guardarse en el edificio, no en una planta.');
}
