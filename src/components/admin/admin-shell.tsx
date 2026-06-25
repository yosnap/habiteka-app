/**
 * Estructura del back-office: barra superior con la identidad del admin y la
 * navegación lateral. Es solo presentación; el acceso ya lo validó el guardia del
 * layout antes de renderizar esto.
 */
import type { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

interface Props {
  adminEmail: string;
  children: ReactNode;
}

export function AdminShell({ adminEmail, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-line flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold tracking-tight">Habiteka · Administración</span>
        <span className="text-muted-foreground text-sm">{adminEmail}</span>
      </header>
      <div className="flex flex-1">
        <aside className="border-line w-56 border-r p-3">
          <AdminNav />
        </aside>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
