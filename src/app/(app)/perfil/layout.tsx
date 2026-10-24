/**
 * «Mi perfil»: panel del usuario con sus datos, su organización, las claves y los modelos de IA. La sesión ya la
 * validó el layout del área autenticada; cada página y cada acción vuelven a leer la organización de la sesión.
 */
import type { ReactNode } from 'react';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { ProfileNav } from '@/components/profile/profile-nav';

export const metadata = { title: 'Mi perfil — Habiteka' };

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, role: true } });
  const initials = (user?.name || user?.email || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <span aria-hidden className="bg-brand-50 text-brand-700 grid size-12 place-items-center rounded-full text-lg font-semibold">{initials}</span>
        <div className="min-w-0">
          <h1 className="text-ink truncate text-2xl font-semibold tracking-tight">{user?.name || 'Mi perfil'}</h1>
          <p className="text-ink-soft truncate text-sm">{user?.email}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside><ProfileNav isAdmin={user?.role === 'admin'} /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
