'use client';

/**
 * Botón de cerrar sesión: usa el cliente de auth del navegador y redirige al
 * inicio. Aislado en su propio cliente para no convertir toda la cabecera en
 * client component.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient, signOut } from '@/lib/auth-client';
import { clearUserDrafts, hasPendingUserDrafts } from '@/canvas/editor-v2/draft-storage';
import { stopEditorSessions } from '@/canvas/editor-v2/session-registry';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupUser = useRef<string | null>(null);

  async function handle() {
    setPending(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      const userId = cleanupUser.current ?? session.data?.user.id;
      if (userId) {
        const unsynced = await hasPendingUserDrafts(userId);
        if (unsynced && !window.confirm('Hay borradores sin sincronizar. Al cerrar sesión se eliminarán de este dispositivo. ¿Quieres salir?')) return;
        await stopEditorSessions(userId);
      }
      const result = await signOut();
      if (result.error) throw new Error('No se pudo cerrar sesión');
      cleanupUser.current = userId ?? null;
      if (userId) await clearUserDrafts(userId);
      cleanupUser.current = null;
      sessionStorage.removeItem('habiteka:dev-preview-document');
      router.push('/');
      router.refresh();
    } catch {
      setError('No se pudo completar el cierre o la limpieza local. Vuelve a intentarlo antes de dejar este dispositivo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <span><button
      type="button"
      onClick={handle}
      disabled={pending}
      className="text-ink-soft hover:text-ink text-xs underline disabled:opacity-50"
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>{error && <span role="alert" className="block text-xs text-red-700">{error}</span>}</span>
  );
}
