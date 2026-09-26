'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import {
  withEditorDocuments,
  type ActivateDocumentInput,
  type SaveDocumentInput,
} from './document-repo';
import type { EditorScope } from './authority';
import type { ApprovedLightingPreset } from '@/lib/editor-document/approved-design';

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

export async function approveEditorDesign(scope: EditorScope, expectedRevision: number, lightingPreset: ApprovedLightingPreset) {
  return withEditorDocuments(await requireOrgContext()).approve(scope, expectedRevision, lightingPreset);
}

export async function loadApprovedEditorDesign(scope: EditorScope, approvalId: string) {
  return withEditorDocuments(await requireOrgContext()).readApproval(scope, approvalId);
}

/** La recuperación crea una revisión nueva; la actual y las aprobaciones permanecen intactas. */
export async function restoreEditorRevision(scope: EditorScope, sourceRevision: number,
  expectedRevision: number, confirmed: true): Promise<{ status: 'restored' | 'conflict'; revision: number }> {
  if (confirmed !== true || sourceRevision >= expectedRevision)
    throw new Error('Selecciona una revisión anterior y confirma la recuperación.');
  const documents = withEditorDocuments(await requireOrgContext());
  const source = await documents.readRevision(scope, sourceRevision);
  const result = await documents.save(scope, {
    document: { ...source, revision: expectedRevision }, expectedRevision,
    requestKey: `restore:${sourceRevision}:${expectedRevision}`,
  });
  if (result.status === 'conflict') return { status: 'conflict', revision: result.document.revision };
  revalidatePath(`/projects/${scope.projectId}`);
  revalidatePath(`/projects/${scope.projectId}/editor`);
  revalidatePath(`/projects/${scope.projectId}/historial`);
  return { status: 'restored', revision: result.document.revision };
}
