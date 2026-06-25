'use client';

/**
 * Botón de cerrar sesión: usa el cliente de auth del navegador y redirige al
 * inicio. Aislado en su propio cliente para no convertir toda la cabecera en
 * client component.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle() {
    setPending(true);
    try {
      await signOut();
      router.push('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="text-ink-soft hover:text-ink text-xs underline disabled:opacity-50"
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
