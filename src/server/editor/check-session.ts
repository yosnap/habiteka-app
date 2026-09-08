'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { withEditorDocuments } from './document-repo';
import type { DraftScope } from '@/canvas/editor-v2/draft-contract';

export async function checkEditorSession(scope: DraftScope): Promise<boolean> {
  try {
    const ctx = await requireOrgContext();
    if (ctx.userId !== scope.userId || ctx.organizationId !== scope.organizationId) return false;
    const result = await withEditorDocuments(ctx).load(scope);
    return result.authority === 'v2' && result.writable;
  } catch { return false; }
}
