/**
 * Layout del back-office. Valida el rol admin en el SERVIDOR antes de renderizar
 * nada: un usuario sin rol admin es redirigido y nunca ve el panel. Es la primera
 * barrera; cada acción administrativa revalida por su cuenta.
 */
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin, ForbiddenAdminError } from '@/server/admin/guard';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof ForbiddenAdminError) {
      redirect('/');
    }
    throw err;
  }

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
