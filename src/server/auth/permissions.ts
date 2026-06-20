/**
 * Chequeos de permisos sobre el contexto de organización.
 *
 * Distingue los roles de miembro (owner/admin/member) para autorizar acciones
 * dentro de una organización. El rol de PLATAFORMA (`admin` global del
 * back-office) es independiente y se resuelve aparte desde la sesión.
 */
import type { OrgContext, MemberRole } from './org-context';

const ROLE_RANK: Record<MemberRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

/** Verdadero si el rol del contexto alcanza al menos `min`. */
export function hasRole(ctx: OrgContext, min: MemberRole): boolean {
  return ROLE_RANK[ctx.role] >= ROLE_RANK[min];
}

export class ForbiddenError extends Error {
  constructor(message = 'Permiso insuficiente') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Lanza `ForbiddenError` si el contexto no alcanza el rol mínimo. */
export function requireRole(ctx: OrgContext, min: MemberRole): void {
  if (!hasRole(ctx, min)) {
    throw new ForbiddenError(`Se requiere rol ${min} o superior`);
  }
}
