'use server';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from './document-repo';
import type { EditorScope } from './authority';
import { fitRenderBackdrop } from '@/lib/editor-document/render-backdrop';

/** Guarda una referencia al render propio, sin depender de una URL presignada que caduca. */
export async function applyRenderBackdrop(scope: EditorScope, deliverableId: string, aspect: number): Promise<boolean> {
  const ctx = await requireOrgContext(), documents = withEditorDocuments(ctx);
  const loaded = await documents.load(scope);
  if (loaded.authority !== 'v2') return false;
  if (!loaded.writable) throw new Error('Este plano está en modo solo lectura.');
  const row = (await withOrg(ctx).deliverables.list(scope.projectId)).find(item => item.id === deliverableId
    && item.type === 'RENDER_3D' && (item.zoneId ?? null) === (scope.zoneId ?? null));
  if (!row) throw new Error('El render no pertenece a este plano.');
  const result = await documents.save(scope, { document: { ...loaded.document,
    renderBackdrop: fitRenderBackdrop(loaded.document, deliverableId, aspect) },
    expectedRevision: loaded.document.revision, requestKey: `backdrop:${crypto.randomUUID()}` });
  if (result.status === 'conflict') throw new Error('El plano cambió. Vuelve a abrirlo antes de aplicar el fondo.');
  revalidatePath(`/projects/${scope.projectId}`); revalidatePath(`/projects/${scope.projectId}/editor`);
  return true;
}
