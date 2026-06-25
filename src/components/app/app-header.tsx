/**
 * Cabecera del área autenticada: marca, saldo de créditos y menú de cuenta.
 * Server component (lee la sesión y el saldo); el botón de cerrar sesión es un
 * cliente aparte para poder usar el cliente de auth del navegador.
 */
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

interface Props {
  userName?: string;
  balance: number;
}

export function AppHeader({ userName, balance }: Props) {
  return (
    <header className="border-line bg-surface sticky top-0 z-40 border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/proyectos" className="text-ink text-lg font-semibold tracking-tight">
          Habiteka
        </Link>
        <div className="flex items-center gap-4 text-sm">
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
