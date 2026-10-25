/**
 * Estructura del back-office: barra superior con accesos a la aplicación y a «Mi perfil», y navegación lateral
 * agrupada. Es solo presentación; el acceso ya lo validó el guardia del layout antes de renderizar esto.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, House, Shield, UserRound } from 'lucide-react';
import { AdminNav } from './admin-nav';

interface Props {
  adminEmail: string;
  children: ReactNode;
}

export function AdminShell({ adminEmail, children }: Props) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-line bg-surface sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="text-ink inline-flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-brand-50 text-brand-700 grid size-7 place-items-center rounded-lg"><House size={16} aria-hidden /></span>
          Habiteka
          <span className="bg-muted text-ink-soft inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"><Shield size={12} aria-hidden />Administración</span>
        </span>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <Link href="/proyectos" className="text-ink-soft hover:text-ink inline-flex items-center gap-1"><ArrowLeft size={14} aria-hidden />Volver a la aplicación</Link>
          <Link href="/perfil" className="text-ink-soft hover:text-ink inline-flex items-center gap-1"><UserRound size={14} aria-hidden />Mi perfil</Link>
          <span className="text-ink-soft hidden sm:inline">{adminEmail}</span>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-line bg-surface border-b p-3 md:w-60 md:shrink-0 md:border-r md:border-b-0">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
