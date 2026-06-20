/**
 * Resuelve el `OrgContext` de la petición actual desde la sesión.
 *
 * Lee la sesión de Better Auth, determina la organización activa y el rol del
 * miembro, y devuelve el contexto que exige el repositorio con ámbito. Lanza si
 * no hay sesión o el usuario no pertenece a la organización: toda Server Action
 * de recurso pasa por aquí antes de tocar la base de datos.
 */
import { headers } from 'next/headers';
import { auth } from './auth';
import { prisma } from '@/server/db/prisma';
import type { OrgContext, MemberRole } from './org-context';

export class UnauthenticatedError extends Error {
  constructor() {
    super('No autenticado');
    this.name = 'UnauthenticatedError';
  }
}

export async function requireOrgContext(): Promise<OrgContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new UnauthenticatedError();
  }

  const userId = session.user.id;
  // Organización activa de la sesión; si no hay, la primera del usuario (su
  // organización personal implícita). El campo lo añade el plugin de organización
  // en runtime, por lo que se lee de forma defensiva.
  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? undefined;

  const member = await prisma.member.findFirst({
    where: { userId, ...(activeOrganizationId ? { organizationId: activeOrganizationId } : {}) },
    select: { organizationId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!member) {
    throw new UnauthenticatedError();
  }

  return {
    organizationId: member.organizationId,
    userId,
    role: normalizeRole(member.role),
  };
}

function normalizeRole(role: string): MemberRole {
  if (role === 'owner' || role === 'admin') return role;
  return 'member';
}
