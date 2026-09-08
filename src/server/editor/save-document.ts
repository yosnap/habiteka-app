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

export async function activateEditorDocument(scope: EditorScope, input: ActivateDocumentInput) {
  return withEditorDocuments(await requireOrgContext()).activate(scope, input);
}
