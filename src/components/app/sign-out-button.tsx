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
  // Hay borradores sin sincronizar: se pide confirmación en línea antes de salir.
  const [warnDrafts, setWarnDrafts] = useState(false);

  async function handle(confirmedDrafts = false) {
    setWarnDrafts(false);
    setPending(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      const userId = cleanupUser.current ?? session.data?.user.id;
      if (userId) {
        const unsynced = await hasPendingUserDrafts(userId);
        if (unsynced && !confirmedDrafts) { setWarnDrafts(true); return; }
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
      onClick={() => handle()}
      disabled={pending}
      className="text-ink-soft hover:text-ink text-xs underline disabled:opacity-50"
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
    {warnDrafts && <span role="group" aria-label="Borradores sin sincronizar" className="block text-xs"
      onKeyDown={(event) => { if (event.key === 'Escape') setWarnDrafts(false); }}>
      <span role="status">Hay borradores sin sincronizar. Al cerrar sesión se eliminarán de este dispositivo.</span>{' '}
      <button type="button" autoFocus className="underline" disabled={pending} onClick={() => handle(true)}>Salir igualmente</button>{' '}
      <button type="button" className="underline" onClick={() => setWarnDrafts(false)}>Cancelar</button>
    </span>}
    {error && <span role="alert" className="block text-xs text-red-700">{error}</span>}</span>
  );
}
