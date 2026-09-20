'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import type { StoryboardGalleryImage } from '@/lib/contracts/storyboard-image';

/** Nunca recibe claves de storage del cliente; resuelve solo entregables de su organización. */
export async function listStoryboardImages(input: EditorScope): Promise<StoryboardGalleryImage[]> {
  const scope = normalizeEditorScope(input);
  const ctx = await requireOrgContext();
  const rows = await withOrg(ctx).deliverables.list(scope.projectId);
  const candidates = rows.filter((row) => row.zoneId === scope.zoneId);
  const results = await Promise.all(candidates.map(async (row) => {
    const payload = row.payload as { type?: string; camera?: unknown; assetKey?: string; assetUrl?: string } | null;
    if (!payload || payload.type !== 'render3d') return null;
    const camera = cameraPoseSchema.safeParse(payload.camera);
    if (!camera.success) return null;
    const assetUrl = await resolveRenderUrl(payload);
    if (!assetUrl || !/^(https?:\/\/|data:image\/)/i.test(assetUrl)) return null;
    return { id: row.id, assetUrl, camera: camera.data, label: `Render · versión ${row.version}` };
  }));
  return results.filter((item): item is StoryboardGalleryImage => item !== null);
}
