'use server';

/**
 * Server Actions de gestión de usuarios. Cada una revalida el rol admin antes de
 * actuar (defensa en profundidad: el guardia del layout no basta) y delega en las
 * operaciones de negocio, que registran la auditoría.
 */
import { requireAdmin } from '../guard';
import {
  listUsers,
  banUser,
  unbanUser,
  setRole,
  revokeSessions,
  type ListUsersQuery,
} from './user-operations';

export async function adminListUsers(query: ListUsersQuery) {
  await requireAdmin();
  return listUsers(query);
}

export async function adminBanUser(targetId: string, reason?: string) {
  const actor = await requireAdmin();
  await banUser(actor.userId, targetId, reason);
}

export async function adminUnbanUser(targetId: string) {
  const actor = await requireAdmin();
  await unbanUser(actor.userId, targetId);
}

export async function adminSetRole(targetId: string, role: 'admin' | 'user') {
  const actor = await requireAdmin();
  await setRole(actor.userId, targetId, role);
}

export async function adminRevokeSessions(targetId: string) {
  const actor = await requireAdmin();
  await revokeSessions(actor.userId, targetId);
}
