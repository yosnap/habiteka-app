import { describe, it, expect, beforeEach } from 'vitest';
import {
  listUsers,
  banUser,
  unbanUser,
  setRole,
  revokeSessions,
  SelfActionError,
} from '@/server/admin/users/user-operations';
import { isAdminRole } from '@/server/admin/guard';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeUser } from '../helpers/db';

async function makeAdmin(): Promise<string> {
  const u = await makeUser();
  await prisma.user.update({ where: { id: u.id }, data: { role: 'admin' } });
  return u.id;
}

async function addSession(userId: string): Promise<void> {
  await prisma.session.create({
    data: {
      id: `sess-${userId}-${Math.random().toString(36).slice(2)}`,
      userId,
      token: `tok-${userId}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
}

describe('isAdminRole', () => {
  it('distingue el rol admin de los demás', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe('user-operations — gestión de usuarios', () => {
  beforeEach(resetDb);

  it('listUsers pagina y no devuelve todos', async () => {
    for (let i = 0; i < 5; i++) await makeUser();
    const { users, total } = await listUsers({ page: 1, pageSize: 2 });
    expect(users).toHaveLength(2);
    expect(total).toBe(5);
  });

  it('listUsers filtra por email', async () => {
    await makeUser('busca@dominio.test');
    await makeUser('otro@dominio.test');
    const { users } = await listUsers({ page: 1, pageSize: 10, search: 'busca@' });
    expect(users).toHaveLength(1);
    expect(users[0]?.email).toBe('busca@dominio.test');
  });

  it('banUser suspende, invalida sesiones y deja auditoría', async () => {
    const admin = await makeAdmin();
    const target = await makeUser();
    await addSession(target.id);

    await banUser(admin, target.id, 'abuso');

    const user = await prisma.user.findUnique({ where: { id: target.id } });
    expect(user?.banned).toBe(true);
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ban_user', targetId: target.id },
    });
    expect(audit?.actorId).toBe(admin);
  });

  it('un admin no puede suspenderse a sí mismo', async () => {
    const admin = await makeAdmin();
    await expect(banUser(admin, admin)).rejects.toBeInstanceOf(SelfActionError);
  });

  it('un admin no puede retirarse su propio rol', async () => {
    const admin = await makeAdmin();
    await expect(setRole(admin, admin, 'user')).rejects.toBeInstanceOf(SelfActionError);
  });

  it('setRole cambia el rol y audita', async () => {
    const admin = await makeAdmin();
    const target = await makeUser();
    await setRole(admin, target.id, 'admin');
    const user = await prisma.user.findUnique({ where: { id: target.id } });
    expect(user?.role).toBe('admin');
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'set_role', targetId: target.id },
    });
    expect((audit?.meta as { role?: string })?.role).toBe('admin');
  });

  it('unban y revokeSessions auditan su acción', async () => {
    const admin = await makeAdmin();
    const target = await makeUser();
    await addSession(target.id);
    await unbanUser(admin, target.id);
    await revokeSessions(admin, target.id);
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { targetId: target.id } })).toBe(2);
  });

  it('la auditoría es inmutable (no se puede modificar ni borrar)', async () => {
    const admin = await makeAdmin();
    const target = await makeUser();
    await setRole(admin, target.id, 'admin');
    const log = await prisma.auditLog.findFirst({ where: { targetId: target.id } });
    await expect(
      prisma.auditLog.update({ where: { id: log!.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow();
  });
});
