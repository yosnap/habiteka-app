/**
 * Operaciones de gestión de usuarios del back-office (lógica de negocio).
 *
 * Reciben el actor de forma explícita para ser testeables sin una sesión HTTP; la
 * resolución del actor (guardia admin) la hace la capa de Server Actions. Cada
 * mutación destructiva valida invariantes y deja traza de auditoría.
 *
 * Invariante clave: un administrador no puede suspenderse ni degradarse a sí
 * mismo (evita que se autobloquee o se quede sin acceso por error).
 */
import { prisma } from '@/server/db/prisma';
import { writeAudit } from '../audit';

export class SelfActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelfActionError';
  }
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** Filtra por estado de suspensión. */
  banned?: boolean;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
}

/** Lista usuarios con paginación y filtro server-side (no devuelve todos). */
export async function listUsers(
  query: ListUsersQuery,
): Promise<{ users: UserRow[]; total: number }> {
  const where = buildWhere(query);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, banned: true },
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, (query.page - 1) * query.pageSize),
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total };
}

/** Suspende a un usuario y registra la acción. Un admin no puede autobanearse. */
export async function banUser(actorId: string, targetId: string, reason?: string): Promise<void> {
  if (actorId === targetId) {
    throw new SelfActionError('Un administrador no puede suspenderse a sí mismo');
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetId }, data: { banned: true, banReason: reason } });
    // Suspender invalida las sesiones activas del usuario afectado.
    await tx.session.deleteMany({ where: { userId: targetId } });
  });
  await writeAudit({ actorId, action: 'ban_user', targetType: 'user', targetId, meta: { reason } });
}

/** Reactiva a un usuario suspendido y registra la acción. */
export async function unbanUser(actorId: string, targetId: string): Promise<void> {
  await prisma.user.update({
    where: { id: targetId },
    data: { banned: false, banReason: null, banExpires: null },
  });
  await writeAudit({ actorId, action: 'unban_user', targetType: 'user', targetId });
}

/** Cambia el rol de plataforma. Un admin no puede degradarse a sí mismo. */
export async function setRole(
  actorId: string,
  targetId: string,
  role: 'admin' | 'user',
): Promise<void> {
  if (actorId === targetId && role !== 'admin') {
    throw new SelfActionError('Un administrador no puede retirarse su propio rol');
  }
  await prisma.user.update({ where: { id: targetId }, data: { role } });
  await writeAudit({ actorId, action: 'set_role', targetType: 'user', targetId, meta: { role } });
}

/** Revoca todas las sesiones de un usuario (forzar logout). */
export async function revokeSessions(actorId: string, targetId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId: targetId } });
  await writeAudit({ actorId, action: 'revoke_sessions', targetType: 'user', targetId });
}

function buildWhere(query: ListUsersQuery) {
  const where: { banned?: boolean; OR?: Array<Record<string, unknown>> } = {};
  if (query.banned !== undefined) where.banned = query.banned;
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
