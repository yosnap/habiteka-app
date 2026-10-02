import type { OrgContext } from '@/server/auth/org-context';
import type { EditorScope } from '@/server/editor/authority';
import { withEditorDocuments } from '@/server/editor/document-repo';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { sameDesignContent } from '@/lib/editor-document/approved-design';

/** La revisión local puede adelantarse a la guardada; la IA usa el documento confirmado. */
export function selectSavedEditorDocument(raw: unknown, saved: EditorDocument): EditorDocument {
  const submitted = parseEditorDocument(raw);
  if (!sameDesignContent(submitted, saved))
    throw new Error('El plano cambió durante la sincronización. Guarda y prepara otra vez el diseño.');
  return saved;
}

export async function verifiedEditorDocument(ctx: OrgContext, scope: EditorScope, raw: unknown): Promise<EditorDocument> {
  const current = await withEditorDocuments(ctx).load(scope);
  if (current.authority !== 'v2') throw new Error('El plano editable ya no está disponible.');
  return selectSavedEditorDocument(raw, current.document);
}
