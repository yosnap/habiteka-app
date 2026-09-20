import type { Prisma } from '@/generated/prisma/client';
import type { OrgContext } from '@/server/auth/org-context';
import { prisma } from '@/server/db/prisma';
export class EditorScopeNotFoundError extends Error {
  constructor() {
    super('Proyecto o zona no encontrado');
  }
}

export interface EditorScope {
  projectId: string;
  zoneId?: string | null;
}
export function normalizeEditorScope(scope: EditorScope) {
  if (
    !scope ||
    typeof scope.projectId !== 'string' ||
    !scope.projectId.trim() ||
    scope.projectId.length > 128 ||
    (scope.zoneId != null &&
      (typeof scope.zoneId !== 'string' || !scope.zoneId.trim() || scope.zoneId.length > 128))
  ) {
    throw new Error('Ámbito de editor inválido');
  }
  return { projectId: scope.projectId, zoneId: scope.zoneId ?? null };
}

/** The project lock serializes activation with legacy writers and soft deletion. */
export async function assertEditorScope(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: EditorScope,
  options: { lock?: boolean; includeDeletedZone?: boolean } = {},
) {
  const scope = normalizeEditorScope(input);
  const project = options.lock
    ? await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM project WHERE id = ${scope.projectId} AND "organizationId" = ${ctx.organizationId} AND "deletedAt" IS NULL FOR UPDATE`
    : await tx.project.findMany({
        where: { id: scope.projectId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
  if (project.length !== 1) throw new EditorScopeNotFoundError();
  if (scope.zoneId !== null) {
    const zones = options.lock
      ? await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM project_zone WHERE id = ${scope.zoneId} AND "projectId" = ${scope.projectId} AND "organizationId" = ${ctx.organizationId} AND (${options.includeDeletedZone ?? false} OR "deletedAt" IS NULL) FOR UPDATE`
      : await tx.projectZone.findMany({
          where: {
            id: scope.zoneId,
            projectId: scope.projectId,
            organizationId: ctx.organizationId,
            ...(options.includeDeletedZone ? {} : { deletedAt: null }),
          },
          select: { id: true },
        });
    if (zones.length !== 1) throw new EditorScopeNotFoundError();
  }
  return scope;
}

export async function withLegacyAuthority<T>(
  ctx: OrgContext,
  scope: EditorScope,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { includeDeletedZone?: boolean } = {},
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const target = await assertEditorScope(tx, ctx, scope, { ...options, lock: true });
    if (await tx.editorDocumentState.findFirst({ where: target, select: { id: true } })) {
      throw new Error('Este plano usa el editor v2; no admite escritura legacy');
    }
    return callback(tx);
  });
}
