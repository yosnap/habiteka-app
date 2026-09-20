'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import {
  withEditorDocuments,
  type ActivateDocumentInput,
  type SaveDocumentInput,
} from './document-repo';
import type { EditorScope } from './authority';

export async function saveEditorDocument(scope: EditorScope, input: SaveDocumentInput) {
  return withEditorDocuments(await requireOrgContext()).save(scope, input);
}

export async function loadCurrentEditorDocument(scope: EditorScope) {
  const result = await withEditorDocuments(await requireOrgContext()).load(scope);
  if (result.authority !== 'v2' || !result.writable) throw new Error('El plano no está disponible para editar.');
  return result.document;
}

export async function activateEditorDocument(scope: EditorScope, input: ActivateDocumentInput) {
  return withEditorDocuments(await requireOrgContext()).activate(scope, input);
}
