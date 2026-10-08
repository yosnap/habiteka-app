'use client';

/**
 * Cabecera del área autenticada: marca, saldo de créditos y menú de cuenta.
 * Recibe sesión y saldo del layout de servidor; adapta la densidad al espacio
 * de trabajo del proyecto. Los permisos se validan siempre en el servidor.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House } from 'lucide-react';
import { SignOutButton } from './sign-out-button';

interface Props {
  userName?: string;
  balance: number;
  /** Muestra el enlace al back-office; el acceso real lo revalida el layout de admin. */
  isAdmin?: boolean;
}

export function AppHeader({ userName, balance, isAdmin }: Props) {
  const workspace = usePathname().startsWith('/projects/');
  return (
    <header className="border-line bg-surface sticky top-0 z-40 border-b">
      <div className={`mx-auto flex w-full items-center justify-between px-5 ${workspace ? 'py-1.5' : 'max-w-5xl py-3'}`}>
        <Link href="/proyectos" className="text-ink inline-flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-700"><House size={16} /></span>Habiteka
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
          <Link href="/ayuda" className="text-ink-soft hover:text-ink">
            Ayuda
          </Link>
          {isAdmin ? (
            <Link href="/config" className="text-ink-soft hover:text-ink">
              Administración
            </Link>
          ) : null}
          <span
            className="bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-medium"
            title="Créditos disponibles"
          >
            {balance} créditos
          </span>
          {userName ? <span className="text-ink-soft hidden sm:inline">{userName}</span> : null}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
